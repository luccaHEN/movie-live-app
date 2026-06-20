import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import '../services/api.dart';
import 'chart_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _storage = const FlutterSecureStorage();
  Map<String, dynamic>? _statsData;
  bool _isLoading = true;
  StreamSubscription? _refreshSubscription;

  @override
  void initState() {
    super.initState();
    _fetchStats();
    _refreshSubscription = refreshStreamController.stream.listen((_) {
      _fetchStats();
    });
  }

  @override
  void dispose() {
    _refreshSubscription?.cancel();
    super.dispose();
  }

  Future<void> _loadCachedStats() async {
    final prefs = await SharedPreferences.getInstance();
    final cachedData = prefs.getString('cached_stats');
    if (cachedData != null) {
      if (mounted) {
        setState(() {
          _statsData = jsonDecode(cachedData);
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _fetchStats() async {
    try {
      await _loadCachedStats(); // Tenta carregar o cache antes de buscar na API
      
      final token = await _storage.read(key: 'token');
      final response = await api.get(
        '/movies/stats',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cached_stats', jsonEncode(response.data));
      
      if (mounted) {
        setState(() {
          _statsData = response.data;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        if (_statsData != null) {
           ScaffoldMessenger.of(context).showSnackBar(
             const SnackBar(content: Text('Modo Offline: Mostrando estatísticas salvas. ⚡', style: TextStyle(color: Colors.white)), backgroundColor: Colors.orange),
           );
        } else {
           ScaffoldMessenger.of(context).showSnackBar(
             const SnackBar(content: Text('Erro ao carregar estatísticas e sem dados locais.', style: TextStyle(color: Colors.white)), backgroundColor: Colors.red),
           );
        }
      }
    }
  }

  Widget _buildStatCard(String title, String value, Color valueColor, {IconData? icon}) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [const Color(0xFF222222), const Color(0xFF1A1A1A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: valueColor.withValues(alpha: 0.3), width: 1),
        boxShadow: [
          BoxShadow(color: valueColor.withValues(alpha: 0.1), blurRadius: 8, offset: const Offset(0, 4)),
        ]
      ),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) Icon(icon, color: valueColor, size: 24),
            if (icon != null) const SizedBox(height: 4),
            Text(title, style: const TextStyle(color: Colors.grey, fontSize: 12), textAlign: TextAlign.center),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(color: valueColor, fontSize: 24, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _buildChampionBanner(dynamic championData) {
    if (championData == null) return const SizedBox.shrink();
    
    final posterUrl = championData['poster'] != null ? 'https://image.tmdb.org/t/p/w300${championData['poster']}' : null;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(
          colors: [Color(0xFFfbbf24), Color(0xFFb45309)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(color: Colors.amber.withValues(alpha: 0.4), blurRadius: 12, offset: const Offset(0, 4))
        ]
      ),
      child: Row(
        children: [
          if (posterUrl != null)
            ClipRRect(
              borderRadius: const BorderRadius.horizontal(left: Radius.circular(16)),
              child: Image.network(posterUrl, width: 100, height: 150, fit: BoxFit.cover),
            ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.emoji_events, color: Colors.white, size: 20),
                      SizedBox(width: 8),
                      Text('CAMPEÃO DO MÊS', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(championData['title'] ?? 'Sem Título', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold), maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 8),
                  Text('Nota: ${championData['streamerRating']} ⭐', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('📊 Estatísticas', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 22, color: Color(0xFF007bff))),
                  if (_statsData != null && _statsData!['moviesPerMonth'] != null)
                    IconButton(
                      icon: const Icon(Icons.bar_chart, color: Color(0xFF007bff)),
                      tooltip: 'Ver Gráfico',
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (context) => ChartScreen(moviesPerMonth: _statsData!['moviesPerMonth'])),
                        );
                      },
                    ),
                ],
              ),
            ),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _statsData == null
                      ? const Center(child: Text('Não foi possível carregar os dados.', style: TextStyle(color: Colors.grey)))
                      : RefreshIndicator(
                          onRefresh: _fetchStats,
                          color: const Color(0xFF007bff),
                          child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Banner do Campeão do Mês
                      Builder(builder: (context) {
                        final currentMonth = DateTime.now().toIso8601String().substring(0, 7);
                        final championData = _statsData!['champions'] != null ? _statsData!['champions'][currentMonth] : null;
                        return _buildChampionBanner(championData);
                      }),
                      
                      // Grid de Estatísticas Rápidas
                      GridView.count(
                        crossAxisCount: 2,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 1.2,
                        children: [
                          _buildStatCard('Total de Filmes', '${_statsData!['totalMovies']}', const Color(0xFF007bff), icon: Icons.movie),
                          _buildStatCard('Assistidos', '${_statsData!['watchedMovies']}', Colors.green, icon: Icons.check_circle),
                          _buildStatCard('Na Fila', '${_statsData!['unwatchedMovies']}', Colors.orangeAccent, icon: Icons.schedule),
                          _buildStatCard('Dias de Tela', '${_statsData!['totalWatchDays']} d', Colors.purpleAccent, icon: Icons.timer),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Row com Top Resgatador e Média Streamer
                      Row(
                        children: [
                          Expanded(
                            child: _buildStatCard(
                              '🏆 Top Resgatador', 
                              _statsData!['topRescuer'] ?? 'Ninguém', 
                              Colors.pinkAccent,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildStatCard(
                              '⭐ Minha Média', 
                              '${_statsData!['avgStreamerRating']}', 
                              Colors.amber,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 32),

                      // Lista dos Próximos da Fila
                      const Text('🍿 Próximos da Fila', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                      const SizedBox(height: 12),
                      
                      ...(_statsData!['upcomingMovies'] as List<dynamic>).map((movie) {
                        final dateStr = movie['watchDate'] != null 
                            ? DateTime.parse(movie['watchDate'].toString()).toLocal().toString().split(' ')[0]
                            : 'Sem data';
                        final posterUrl = movie['poster'] != null ? 'https://image.tmdb.org/t/p/w200${movie['poster']}' : null;

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF141414),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                          ),
                          child: Row(
                            children: [
                              ClipRRect(
                                borderRadius: const BorderRadius.horizontal(left: Radius.circular(12)),
                                child: posterUrl != null
                                  ? Image.network(posterUrl, width: 80, height: 120, fit: BoxFit.cover)
                                  : Container(width: 80, height: 120, color: const Color(0xFF2A2A2A), child: const Icon(Icons.movie, color: Colors.white54)),
                              ),
                              Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.all(16.0),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(movie['title'] ?? 'Desconhecido', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white)),
                                      const SizedBox(height: 8),
                                      Row(
                                        children: [
                                          const Icon(Icons.calendar_month, size: 14, color: Color(0xFF007bff)),
                                          const SizedBox(width: 4),
                                          Text(dateStr, style: const TextStyle(color: Color(0xFF007bff), fontWeight: FontWeight.bold)),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              )
                            ],
                          ),
                        );
                      }),
                      
                      if ((_statsData!['upcomingMovies'] as List<dynamic>).isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(16.0),
                          child: Text('Nenhum filme agendado.', style: TextStyle(color: Colors.grey), textAlign: TextAlign.center),
                        ),
                    ],
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}