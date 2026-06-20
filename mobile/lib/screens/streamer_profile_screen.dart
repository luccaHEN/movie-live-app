import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/api.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:intl/intl.dart';
import 'package:dio/dio.dart';

class StreamerProfileScreen extends StatefulWidget {
  final int streamerId;
  final String streamerName;
  final String? streamerAvatar;
  final String? initialSearchQuery;
  final int initialTabIndex;

  const StreamerProfileScreen({
    super.key,
    required this.streamerId,
    required this.streamerName,
    this.streamerAvatar,
    this.initialSearchQuery,
    this.initialTabIndex = 0,
  });

  @override
  State<StreamerProfileScreen> createState() => _StreamerProfileScreenState();
}

class _StreamerProfileScreenState extends State<StreamerProfileScreen> {
  final _storage = const FlutterSecureStorage();
  List<dynamic> _movies = [];
  String _searchQuery = '';
  bool _isLoading = true;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (widget.initialSearchQuery != null) {
      _searchQuery = widget.initialSearchQuery!.toLowerCase();
      _searchController.text = widget.initialSearchQuery!;
    }
    _fetchStreamerMovies();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchStreamerMovies() async {
    try {
      final token = await _storage.read(key: 'token');
      if (token == null) return;

      final response = widget.streamerId == 0 
        ? await api.get('/community/streamer-by-name/${widget.streamerName}',
            options: Options(headers: {'Authorization': 'Bearer $token'})
          )
        : await api.get('/community/streamer/${widget.streamerId}',
            options: Options(headers: {'Authorization': 'Bearer $token'})
          );
      
      if (mounted) {
        setState(() {
          _movies = response.data['movies'] ?? [];
          // Sort by watchDate if available
          _movies.sort((a, b) {
            if (a['watchDate'] == null && b['watchDate'] == null) return 0;
            if (a['watchDate'] == null) return 1;
            if (b['watchDate'] == null) return -1;
            return DateTime.parse(a['watchDate']).compareTo(DateTime.parse(b['watchDate']));
          });
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Widget _buildMovieCard(dynamic movie) {
    final posterUrl = movie['poster'] != null ? 'https://image.tmdb.org/t/p/w300${movie['poster']}' : null;
    
    String watchDateStr = 'Sem data definida';
    if (movie['watchDate'] != null) {
      final date = DateTime.parse(movie['watchDate']);
      final dayName = DateFormat('EEEE', 'pt_BR').format(date);
      // Capitaliza a primeira letra do dia da semana (ex: "segunda-feira" -> "Segunda-feira")
      final capitalizedDay = "${dayName[0].toUpperCase()}${dayName.substring(1)}";
      final dayAndMonth = DateFormat('dd/MM', 'pt_BR').format(date);
      watchDateStr = "$capitalizedDay, $dayAndMonth";
    }

    final isWatched = movie['watched'] == true;
    final isChampion = movie['isChampion'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF141414),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isChampion ? Colors.amber : Colors.white.withValues(alpha: 0.05),
          width: isChampion ? 2.0 : 1.0,
        ),
        boxShadow: isChampion ? [
          BoxShadow(color: Colors.amber.withValues(alpha: 0.2), blurRadius: 12, offset: const Offset(0, 4))
        ] : null,
      ),
      child: Stack(
        children: [
          Row(
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.horizontal(left: Radius.circular(16)),
                child: posterUrl != null
                    ? CachedNetworkImage(
                        imageUrl: posterUrl,
                        width: 100,
                        height: 150,
                        fit: BoxFit.cover,
                      )
                    : Container(
                        width: 100,
                        height: 150,
                        color: const Color(0xFF2A2A2A),
                        child: const Icon(Icons.movie, color: Colors.white54, size: 40),
                      ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        movie['title'] ?? 'Sem Título',
                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(Icons.calendar_month, size: 14, color: isWatched ? Colors.green : const Color(0xFF007bff)),
                          const SizedBox(width: 4),
                          Text(
                            watchDateStr,
                            style: TextStyle(color: isWatched ? Colors.green : const Color(0xFF007bff), fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (movie['requestedBy'] != null && movie['requestedBy'].toString().isNotEmpty)
                        Row(
                          children: [
                            const Icon(Icons.person, size: 14, color: Colors.white54),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                'Resgatado por: ${movie['requestedBy']}',
                                style: const TextStyle(color: Colors.white54, fontSize: 12),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      if (isWatched && movie['streamerRating'] != null) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(Icons.star, size: 14, color: Colors.amber),
                            const SizedBox(width: 4),
                            Text(
                              '${movie['streamerRating']}/10',
                              style: const TextStyle(color: Colors.amber, fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ]
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (isChampion)
            Positioned(
              top: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: const BoxDecoration(
                  color: Colors.amber,
                  borderRadius: BorderRadius.only(
                    topRight: Radius.circular(14),
                    bottomLeft: Radius.circular(14),
                  ),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.emoji_events, color: Colors.black, size: 14),
                    SizedBox(width: 4),
                    Text('CAMPEÃO', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 10)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      initialIndex: widget.initialTabIndex,
      child: Scaffold(
        backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0A0A),
        elevation: 0,
        bottom: const TabBar(
          indicatorColor: Color(0xFF007bff),
          labelColor: Color(0xFF007bff),
          unselectedLabelColor: Colors.white54,
          tabs: [
            Tab(text: 'Agendados'),
            Tab(text: 'Já Assistidos'),
          ],
        ),
        title: Row(
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: const Color(0xFF2A2A2A),
              backgroundImage: widget.streamerAvatar != null && widget.streamerAvatar!.isNotEmpty
                  ? CachedNetworkImageProvider(widget.streamerAvatar!)
                  : null,
              child: widget.streamerAvatar == null || widget.streamerAvatar!.isEmpty
                  ? const Icon(Icons.person, color: Colors.white54, size: 16)
                  : null,
            ),
            const SizedBox(width: 12),
            Text('Agenda de ${widget.streamerName}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: TextField(
                      controller: _searchController,
                      decoration: InputDecoration(
                        hintText: 'Pesquisar filme...',
                        prefixIcon: const Icon(Icons.search, color: Colors.white54),
                        filled: true,
                        fillColor: const Color(0xFF141414),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(vertical: 0),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, color: Colors.grey, size: 20),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() {
                                    _searchQuery = '';
                                  });
                                },
                              )
                            : null,
                      ),
                      style: const TextStyle(color: Colors.white),
                      onChanged: (value) {
                        setState(() {
                          _searchQuery = value.toLowerCase();
                        });
                      },
                    ),
                  ),
                  Expanded(
                    child: TabBarView(
                      children: [
                        _buildMovieList(false),
                        _buildMovieList(true),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    ));
  }

  Widget _buildMovieList(bool isWatched) {
    final filteredMovies = _movies.where((movie) {
      final matchesSearch = (movie['title'] ?? '').toLowerCase().contains(_searchQuery);
      final matchesStatus = (movie['watched'] == true) == isWatched;
      return matchesSearch && matchesStatus;
    }).toList();

    if (filteredMovies.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(isWatched ? Icons.history : Icons.videocam_off, size: 80, color: Colors.white24),
            const SizedBox(height: 16),
            Text(
              _searchQuery.isNotEmpty 
                ? 'Nenhum filme encontrado na pesquisa.' 
                : '${widget.streamerName} não tem filmes ${isWatched ? 'assistidos' : 'agendados'}.', 
              style: const TextStyle(color: Colors.white70)
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: filteredMovies.length,
      itemBuilder: (context, index) {
        return _buildMovieCard(filteredMovies[index]);
      },
    );
  }
}
