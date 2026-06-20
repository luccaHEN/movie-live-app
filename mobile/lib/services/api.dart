import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final StreamController<void> refreshStreamController = StreamController<void>.broadcast();

// Chave global de navegação — permite o interceptor redirecionar para o Login
// mesmo sem ter acesso a um BuildContext.
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

// ATENÇÃO: Substitua o IP abaixo pelo IPv4 da sua máquina na rede local!
// Exemplo: 'http://192.168.1.15:3333'
const String baseUrl = 'http://192.168.0.4:3333'; 

final Dio api = Dio(
  BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
    headers: {
      'Content-Type': 'application/json',
    },
  ),
)..interceptors.add(_TokenRefreshInterceptor());

/// Interceptor que detecta respostas 401 (token expirado) e tenta
/// renovar o token automaticamente via POST /refresh-token.
/// Se a renovação falhar, redireciona o usuário para a tela de login.
class _TokenRefreshInterceptor extends Interceptor {
  final _storage = const FlutterSecureStorage();
  bool _isRefreshing = false;
  final List<_PendingRequest> _pendingRequests = [];

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    // Só tenta refresh para erros 401 que NÃO são da própria rota de refresh
    if (err.response?.statusCode != 401 ||
        err.requestOptions.path == '/refresh-token' ||
        err.requestOptions.path == '/login') {
      return handler.next(err);
    }

    // Se já estiver fazendo refresh, enfileira esta request para retentar depois
    if (_isRefreshing) {
      _pendingRequests.add(_PendingRequest(err.requestOptions, handler));
      return;
    }

    _isRefreshing = true;

    try {
      final oldToken = await _storage.read(key: 'token');
      if (oldToken == null || oldToken.isEmpty) {
        _forceLogout();
        return handler.next(err);
      }

      // Usa um Dio separado para evitar loop infinito com o próprio interceptor
      final refreshDio = Dio(BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
      ));

      final response = await refreshDio.post(
        '/refresh-token',
        options: Options(headers: {'Authorization': 'Bearer $oldToken'}),
      );

      final newToken = response.data['token'] as String;

      // Salva o novo token
      await _storage.write(key: 'token', value: newToken);

      // Retenta a request original com o novo token
      err.requestOptions.headers['Authorization'] = 'Bearer $newToken';
      final retryResponse = await api.fetch(err.requestOptions);
      handler.resolve(retryResponse);

      // Retenta todas as requests que ficaram na fila
      for (final pending in _pendingRequests) {
        pending.options.headers['Authorization'] = 'Bearer $newToken';
        try {
          final retryResp = await api.fetch(pending.options);
          pending.handler.resolve(retryResp);
        } catch (e) {
          pending.handler.next(DioException(
            requestOptions: pending.options,
            error: e,
          ));
        }
      }
    } on DioException {
      // Refresh falhou → token muito antigo ou inválido → força login
      _forceLogout();
      handler.next(err);

      // Rejeita todas as requests pendentes
      for (final pending in _pendingRequests) {
        pending.handler.next(DioException(
          requestOptions: pending.options,
          error: 'Sessão expirada',
        ));
      }
    } finally {
      _isRefreshing = false;
      _pendingRequests.clear();
    }
  }

  /// Limpa o token e redireciona para a tela de login
  void _forceLogout() {
    _storage.delete(key: 'token');
    final navigator = navigatorKey.currentState;
    if (navigator != null) {
      // Importação lazy para evitar dependência circular
      navigator.pushNamedAndRemoveUntil('/login', (_) => false);
    }
  }
}

class _PendingRequest {
  final RequestOptions options;
  final ErrorInterceptorHandler handler;
  _PendingRequest(this.options, this.handler);
}