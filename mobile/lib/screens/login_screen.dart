import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';
import 'package:local_auth/local_auth.dart';
import '../services/api.dart';
import 'main_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _storage = const FlutterSecureStorage();
  bool _isLoading = false;

  final LocalAuthentication _auth = LocalAuthentication();
  bool _canCheckBiometrics = false;
  bool _hasTokenSaved = false;

  @override
  void initState() {
    super.initState();
    _checkTokenAndBiometrics();
  }

  Future<void> _checkTokenAndBiometrics() async {
    try {
      final bool canCheck = await _auth.canCheckBiometrics || await _auth.isDeviceSupported();
      setState(() {
        _canCheckBiometrics = canCheck;
      });

      final token = await _storage.read(key: 'token');
      if (token != null && token.isNotEmpty) {
        setState(() {
          _hasTokenSaved = true;
        });

        if (canCheck) {
          // Tenta autenticar automaticamente se houver token salvo
          _authenticateWithBiometrics();
        }
      } else {
        if (canCheck && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Biometria disponível! Faça login com e-mail/senha uma vez para ativá-la.'),
              backgroundColor: Color(0xFF007bff),
              duration: Duration(seconds: 4),
            ),
          );
        }
      }
    } catch (e) {
      debugPrint("Erro ao verificar biometria: $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erro de Biometria: $e\n\nCertifique-se de fechar o app e rodar "flutter run" novamente no PC.'),
            backgroundColor: Colors.redAccent,
            duration: const Duration(seconds: 8),
          ),
        );
      }
    }
  }

  Future<void> _authenticateWithBiometrics() async {
    try {
      final bool authenticated = await _auth.authenticate(
        localizedReason: 'Autentique-se para acessar o Sumasflix',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );

      if (authenticated) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Autenticado com sucesso! ✅'), backgroundColor: Colors.green),
          );
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (context) => const MainScreen()),
          );
        }
      }
    } catch (e) {
      debugPrint("Erro ao autenticar: $e");
    }
  }

  Future<void> _handleLogin() async {
    setState(() {
      _isLoading = true;
    });

    try {
      // Faz a requisição POST para a sua rota AuthController
      final response = await api.post('/login', data: {
        'email': _emailController.text,
        'password': _passwordController.text,
      });

      final token = response.data['token'];

      // Salva o token de forma segura (Equivalente ao localStorage.setItem)
      await _storage.write(key: 'token', value: token);
      
      // Pega o Player ID do OneSignal e salva no nosso backend
      final hasPermission = await OneSignal.Notifications.requestPermission(true);
      if (hasPermission) {
        final deviceState = OneSignal.User.pushSubscription;
        if (deviceState.id != null) {
          try {
            await api.post('/users/set-player-id',
              data: {'playerId': deviceState.id},
              options: Options(headers: {'Authorization': 'Bearer $token'})
            );
          } catch (e) { debugPrint("Erro ao salvar Player ID: $e"); }
        }
      }

      if (mounted) {
        // Registra o aparelho deste Viewer no OneSignal com o ID do banco
        OneSignal.login(response.data['user']['id'].toString());

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Login realizado com sucesso!'), backgroundColor: Colors.green),
        );
        
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => MainScreen()),
        );
      }
    } on DioException catch (e) {
      String errorMessage = 'Erro ao conectar com o servidor.';
      if (e.response != null && e.response?.data != null) {
        errorMessage = e.response?.data['error'] ?? errorMessage;
      }
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(errorMessage), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Imagem de fundo cobrindo toda a tela
          Positioned.fill(
            child: Image.asset(
              'assets/images/login.jpg',
              fit: BoxFit.cover,
            ),
          ),
          // Máscara escura translúcida por cima para legibilidade
          Positioned.fill(
            child: Container(
              color: Colors.black.withOpacity(0.8), // 80% opacidade para excelente contraste
            ),
          ),
          // Conteúdo principal por cima
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(32.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'SUMASFLIX',
                    style: TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF007bff), // Azul Primário
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text('Acesso Restrito', style: TextStyle(color: Colors.grey, fontSize: 16)),
                  const SizedBox(height: 40),
                  TextField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Seu e-mail cadastrado',
                      border: OutlineInputBorder(),
                      filled: true,
                      fillColor: Color(0xFF222222), // Cor dos cards do CSS
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Sua senha secreta',
                      border: OutlineInputBorder(),
                      filled: true,
                      fillColor: Color(0xFF222222),
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handleLogin,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF007bff),
                        foregroundColor: Colors.white,
                      ),
                      child: _isLoading
                          ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text('Entrar no Painel', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  if (_canCheckBiometrics && _hasTokenSaved) ...[
                    const SizedBox(height: 24),
                    IconButton(
                      icon: const Icon(Icons.fingerprint, size: 48, color: Color(0xFF007bff)),
                      tooltip: 'Entrar com Biometria',
                      onPressed: _authenticateWithBiometrics,
                    ),
                    const SizedBox(height: 4),
                    const Text('Entrar com Biometria', style: TextStyle(color: Colors.grey, fontSize: 12)),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}