import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;
import 'package:flutter/material.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  /// Inicializa o plugin de notificações locais.
  /// Deve ser chamado uma única vez no main() antes de usar qualquer outro método.
  Future<void> init() async {
    if (_initialized) return;

    tz.initializeTimeZones();

    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/launcher_icon');

    const DarwinInitializationSettings iosSettings =
        DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const InitializationSettings settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    // v22 usa named parameter "settings:"
    await _plugin.initialize(
      settings: settings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );

    _initialized = true;
  }

  /// Callback quando o usuário toca na notificação
  void _onNotificationTapped(NotificationResponse response) {
    // Pode ser expandido futuramente para abrir a tela do filme
    debugPrint('[NotificationService] Notification tapped: ${response.payload}');
  }

  /// Solicita permissão de notificação no Android 13+
  Future<void> requestPermissions() async {
    final android = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await android?.requestNotificationsPermission();
  }

  /// Mostra uma notificação instantânea (ex: "Filme adicionado à agenda")
  /// v22 API: show({required int id, String? title, String? body, NotificationDetails? notificationDetails})
  Future<void> showImmediateNotification(String title, String body) async {
    await _plugin.show(
      id: DateTime.now().millisecondsSinceEpoch.remainder(100000),
      title: title,
      body: body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'movie_alerts',
          'Alertas de Filmes',
          channelDescription: 'Alertas instantâneos sobre agendamentos de filmes',
          importance: Importance.max,
          priority: Priority.high,
          icon: '@mipmap/launcher_icon',
          color: Color(0xFF007bff),
        ),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }

  /// Agenda uma notificação local para as 18h do dia do filme.
  /// v22 API: zonedSchedule({required int id, required TZDateTime scheduledDate,
  ///   required NotificationDetails notificationDetails, required AndroidScheduleMode androidScheduleMode,
  ///   String? title, String? body, ...})
  Future<void> scheduleMovieNotification(int movieId, String movieTitle, DateTime watchDate) async {
    final scheduledDate = DateTime(watchDate.year, watchDate.month, watchDate.day, 18, 0);

    // Não agenda se a data/hora já passou
    if (scheduledDate.isBefore(DateTime.now())) return;

    await _plugin.zonedSchedule(
      id: movieId,
      title: 'Hoje tem filme: $movieTitle 🍿',
      body: 'Prepare a pipoca! A live começa logo mais à noite.',
      scheduledDate: tz.TZDateTime.from(scheduledDate, tz.local),
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'movie_reminders',
          'Lembretes de Filmes',
          channelDescription: 'Lembrete agendado para o dia do filme',
          importance: Importance.max,
          priority: Priority.high,
          icon: '@mipmap/launcher_icon',
          color: Color(0xFF007bff),
        ),
        iOS: DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
    );
  }

  /// Cancela a notificação agendada de um filme específico.
  /// v22 API: cancel({required int id, String? tag})
  Future<void> cancelMovieNotification(int movieId) async {
    await _plugin.cancel(id: movieId);
  }

  /// Re-sincroniza TODAS as notificações agendadas com base na lista atual de filmes.
  /// Cancela tudo e re-agenda apenas os filmes pendentes (não assistidos e com data futura).
  Future<void> syncMovieNotifications(List<dynamic> movies) async {
    await _plugin.cancelAll();

    for (final movie in movies) {
      if (movie['watchDate'] != null && movie['watched'] != true) {
        final date = DateTime.parse(movie['watchDate']);
        await scheduleMovieNotification(movie['id'], movie['title'], date);
      }
    }
  }
}
