import 'package:flutter/material.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'screens/login_screen.dart';
import 'screens/streamer_profile_screen.dart';
import 'services/api.dart';
import 'services/notification_service.dart';
import 'env.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Inicializa locale pt_BR uma única vez no startup
  await initializeDateFormatting('pt_BR');
  
  // Inicializa o OneSignal (Push Notifications do Backend)
  OneSignal.Debug.setLogLevel(OSLogLevel.verbose);
  OneSignal.initialize(Env.oneSignalAppId); 
  OneSignal.Notifications.requestPermission(true);

  // Escuta o clique na notificação Push do OneSignal
  OneSignal.Notifications.addClickListener((event) {
    final data = event.notification.additionalData;
    if (data != null && data['streamerName'] != null) {
      final streamerName = data['streamerName'] as String;
      final movieTitle = data['movieTitle'] as String?;
      final isWatched = data['isWatched'] as bool? ?? false;
      // Navega direto para a aba do perfil do streamer se o app estiver aberto ou em background
      final context = navigatorKey.currentContext;
      if (context != null) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => StreamerProfileScreen(
              streamerId: 0, // Como vem pelo push, talvez falte o ID. O ideal seria ter o ID no payload, mas podemos fazer buscar por nome ou ignorar o avatar provisoriamente
              streamerName: streamerName,
              initialSearchQuery: movieTitle,
              initialTabIndex: isWatched ? 1 : 0,
            ),
          ),
        );
      }
    }
  });

  // Inicializa as Notificações Locais (Lembretes Inteligentes)
  await NotificationService().init();
  await NotificationService().requestPermissions();

  runApp(const SumasflixApp());
}

class SumasflixApp extends StatelessWidget {
  const SumasflixApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sumasflix',
      debugShowCheckedModeBanner: false, // Tira aquela faixa de "DEBUG" da tela
      navigatorKey: navigatorKey, // Permite o interceptor de token navegar para o login
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF007bff), // Sua cor primária (Azul do Sumasflix)
          brightness: Brightness.dark, // Modo escuro por padrão, como na Web
        ),
        scaffoldBackgroundColor: const Color(0xFF141414), // Cor de fundo do seu CSS (--bg-color)
        useMaterial3: true,
      ),
      home: const LoginScreen(),
      routes: {
        '/login': (context) => const LoginScreen(),
      },
    );
  }
}