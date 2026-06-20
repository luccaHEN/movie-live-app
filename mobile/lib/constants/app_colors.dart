import 'package:flutter/material.dart';

/// Constantes de cores do app para evitar re-instanciação em cada build.
/// Todas as cores são compile-time constants.
class AppColors {
  AppColors._(); // Impede instanciação

  static const Color primary = Color(0xFF007bff);
  static const Color card = Color(0xFF222222);
  static const Color background = Color(0xFF141414);
  static const Color cardBorder = Color(0xFF333333);
}
