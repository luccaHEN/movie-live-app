import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/api.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'streamer_profile_screen.dart';
import 'package:dio/dio.dart';

class CommunityScreen extends StatefulWidget {
  const CommunityScreen({super.key});

  @override
  State<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends State<CommunityScreen> {
  final _storage = const FlutterSecureStorage();
  List<dynamic> _streamers = [];
  List<String> _followedStreamers = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchCommunityData();
  }

  Future<void> _fetchCommunityData() async {
    try {
      final token = await _storage.read(key: 'token');
      if (token == null) return;

      // Busca o perfil para saber quem eu já sigo
      final profileRes = await api.get('/profile', options: Options(headers: {'Authorization': 'Bearer $token'}));
      if (profileRes.data['followedStreamersList'] != null) {
         _followedStreamers = List<String>.from(profileRes.data['followedStreamersList']);
      }

      // Busca todos os streamers da plataforma
      final streamersRes = await api.get('/community/streamers', options: Options(headers: {'Authorization': 'Bearer $token'}));
      
      if (mounted) {
        setState(() {
          _streamers = streamersRes.data;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _toggleFollow(String streamerName) async {
    try {
      final token = await _storage.read(key: 'token');
      if (token == null) return;

      final isFollowing = _followedStreamers.contains(streamerName);
      
      setState(() {
        if (isFollowing) {
          _followedStreamers.remove(streamerName);
        } else {
          _followedStreamers.add(streamerName);
        }
      });

      await api.post('/community/follow', 
        data: { 'streamerName': streamerName },
        options: Options(headers: {'Authorization': 'Bearer $token'})
      );
      
    } catch (e) {
      // Revert in case of error
      setState(() {
        if (_followedStreamers.contains(streamerName)) {
           _followedStreamers.remove(streamerName);
        } else {
           _followedStreamers.add(streamerName);
        }
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Erro ao atualizar. Tente novamente.'), backgroundColor: Colors.red));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _streamers.isEmpty
                ? const Center(child: Text('Nenhum streamer encontrado.', style: TextStyle(color: Colors.white70)))
                : RefreshIndicator(
                    onRefresh: _fetchCommunityData,
                    color: const Color(0xFF007bff),
                    backgroundColor: const Color(0xFF141414),
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                      itemCount: _streamers.length,
                      itemBuilder: (context, index) {
                        final streamer = _streamers[index];
                        final movieCount = streamer['_count']?['movies'] ?? 0;
                        final isFollowing = _followedStreamers.contains(streamer['name']);

                        return GestureDetector(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => StreamerProfileScreen(
                                  streamerId: streamer['id'],
                                  streamerName: streamer['name'] ?? 'Streamer',
                                  streamerAvatar: streamer['avatar'],
                                ),
                              ),
                            );
                          },
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 16),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xFF141414),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                            ),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 30,
                                  backgroundColor: const Color(0xFF2A2A2A),
                                  backgroundImage: streamer['avatar'] != null && streamer['avatar'].isNotEmpty
                                      ? CachedNetworkImageProvider(streamer['avatar'])
                                      : null,
                                  child: streamer['avatar'] == null || streamer['avatar'].isEmpty
                                      ? const Icon(Icons.person, color: Colors.white54, size: 30)
                                      : null,
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        streamer['name'] ?? 'Usuário',
                                        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '$movieCount filmes na agenda',
                                        style: const TextStyle(color: Colors.white54, fontSize: 14),
                                      ),
                                    ],
                                  ),
                                ),
                                ElevatedButton(
                                  onPressed: () => _toggleFollow(streamer['name']),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: isFollowing ? Colors.transparent : const Color(0xFF007bff),
                                    foregroundColor: isFollowing ? const Color(0xFF007bff) : Colors.white,
                                    elevation: 0,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      side: BorderSide(color: isFollowing ? const Color(0xFF007bff) : Colors.transparent),
                                    ),
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                  ),
                                  child: Text(isFollowing ? 'Seguindo' : 'Seguir', style: const TextStyle(fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
      ),
    );
  }
}
