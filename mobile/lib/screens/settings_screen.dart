import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import '../services/api.dart';

import 'package:image_picker/image_picker.dart';
import 'login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _storage = const FlutterSecureStorage();
  final _nameController = TextEditingController();
  String _avatar = ''; // Trocamos o controller por uma string
  Uint8List? _cachedAvatarBytes;
  bool _streamerMode = true;
  bool _isLoading = true;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // Carrega os dados do banco de dados (Node.js)
      final token = await _storage.read(key: 'token');
      final response = await api.get(
        '/profile',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (mounted) {
        setState(() {
          _nameController.text = response.data['name'] ?? '';
          _avatar = response.data['avatar'] ?? '';
          if (_avatar.startsWith('data:image')) {
            _cachedAvatarBytes = base64Decode(_avatar.split(',').last);
          }
          _streamerMode = response.data['isStreamerMode'] ?? prefs.getBool('streamerMode') ?? true;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erro ao carregar perfil.', style: TextStyle(color: Colors.white)), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70, maxWidth: 512);

    if (pickedFile != null) {
      final imageBytes = await File(pickedFile.path).readAsBytes();
      // Converte a imagem para Base64 e adiciona o prefixo de Data URI
      final base64Image = 'data:image/jpeg;base64,${base64Encode(imageBytes)}';
      setState(() {
        _avatar = base64Image;
        _cachedAvatarBytes = imageBytes;
      });
    }
  }

  ImageProvider _getAvatarImage() {
    if (_avatar.startsWith('data:image')) {
      return MemoryImage(_cachedAvatarBytes!);
    }
    if (_avatar.isNotEmpty) {
      return NetworkImage(_avatar);
    }
    return const AssetImage('assets/placeholder.png'); // Adicione uma imagem placeholder se quiser
  }

  Future<void> _saveProfile() async {
    setState(() => _isSaving = true);
    try {
      final token = await _storage.read(key: 'token');
      await api.put(
        '/profile',
        data: {
          'name': _nameController.text.trim(),
          'avatar': _avatar,
          'isStreamerMode': _streamerMode,
        },
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      
      refreshStreamController.add(null);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('streamerMode', _streamerMode);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Configurações salvas! ✅', style: TextStyle(color: Colors.white)), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erro ao salvar configurações.'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  Future<void> _logout() async {
    await _storage.delete(key: 'token');
    if (mounted) {
      // Volta para a tela de login limpando o histórico de navegação
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (context) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(bottom: 24.0),
                      child: Text('⚙️ Configurações', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 22, color: Color(0xFF007bff))),
                    ),
                  Center(
                    child: CircleAvatar(
                      radius: 50,
                      backgroundColor: const Color(0xFF141414),
                      backgroundImage: _getAvatarImage(),
                      child: _avatar.isEmpty ? const Icon(Icons.person, size: 50, color: Colors.grey) : null,
                    ),
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _nameController,
                    decoration: const InputDecoration(labelText: 'Nome de Exibição', border: OutlineInputBorder(), filled: true, fillColor: Color(0xFF141414)),
                  ),
                  const SizedBox(height: 16),
                  // Botão para escolher a imagem
                  ElevatedButton.icon(
                    icon: const Icon(Icons.photo_library),
                    label: const Text('Escolher Foto de Perfil'),
                    onPressed: _pickImage,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 24),
                  SwitchListTile(
                    title: const Text('Modo Streamer', style: TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: const Text('Habilita campos de resgates, notas e agenda.'),
                    value: _streamerMode,
                    activeColor: const Color(0xFF007bff),
                    tileColor: const Color(0xFF222222),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    onChanged: (bool value) => setState(() => _streamerMode = value),
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: _isSaving ? null : _saveProfile,
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 16)),
                    child: _isSaving
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Salvar Alterações', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _logout,
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 16)),
                    child: const Text('🚪 Sair (Logoff)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
      ),
    );
  }
}