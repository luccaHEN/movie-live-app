import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import '../services/api.dart';
import '../services/notification_service.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:intl/intl.dart';


class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _storage = const FlutterSecureStorage();
  final _searchController = TextEditingController();
  final ValueNotifier<bool> _hasText = ValueNotifier(false);
  Timer? _debounce;
  
  List<dynamic> _movies = [];
  Set<int> _savedMovieIds = {};
  bool _isLoading = false;
  int _page = 1;
  bool _hasMore = true;
  String _currentQuery = '';
  StreamSubscription? _refreshSubscription;

  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _fetchSavedMovies();
    _fetchMovies();
    
    // Listener para o Scroll Infinito (Paginação)
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200 && !_isLoading && _hasMore) {
        _page++;
        _fetchMovies();
      }
    });

    _refreshSubscription = refreshStreamController.stream.listen((_) {
      _fetchSavedMovies();
    });
  }

  @override
  void dispose() {
    _hasText.dispose();
    _searchController.dispose();
    _scrollController.dispose();
    _debounce?.cancel();
    _refreshSubscription?.cancel();
    super.dispose();
  }

  // Busca os IDs dos filmes que já estão na fila para não deixar salvar duplicado
  Future<void> _fetchSavedMovies() async {
    try {
      final token = await _storage.read(key: 'token');
      final response = await api.get('/movies', options: Options(headers: {'Authorization': 'Bearer $token'}));
      
      if (!mounted) return;

      setState(() {
        _savedMovieIds = Set<int>.from(response.data.map((m) => m['tmdbId']));
      });
    } catch (e) {
      debugPrint('Erro ao buscar filmes salvos: $e');
    }
  }

  Future<void> _fetchMovies() async {
    if (_isLoading) return;
    setState(() => _isLoading = true);

    try {
      final token = await _storage.read(key: 'token');
      Response response;
      
      if (_currentQuery.trim().isEmpty) {
        response = await api.get('/movies/popular?page=$_page', options: Options(headers: {'Authorization': 'Bearer $token'}));
      } else {
        response = await api.get('/movies/search?query=$_currentQuery&page=$_page', options: Options(headers: {'Authorization': 'Bearer $token'}));
      }

      // Filtra apenas filmes que possuem capinha
      final List<dynamic> newMovies = response.data.where((m) => m['poster_path'] != null).toList();
      
      if (!mounted) return;

      setState(() {
        if (_page == 1) {
          _movies = newMovies;
        } else {
          _movies.addAll(newMovies);
        }
        _hasMore = newMovies.isNotEmpty;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Erro ao buscar filmes.', style: TextStyle(color: Colors.white)), backgroundColor: Colors.red));
      }
    }
  }

  // Função de busca com Debounce para não travar a API enquanto digita
  void _onSearchChanged(String query) {
    _hasText.value = query.isNotEmpty;
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 600), () {
      if (_currentQuery != query) {
        setState(() {
          _currentQuery = query;
          _page = 1;
          _hasMore = true;
        });
        _fetchMovies();
      }
    });
  }

  // Função que abre a modal na parte de baixo da tela
  void _showSaveBottomSheet(dynamic movie) {
    final TextEditingController requestedByController = TextEditingController();
    DateTime? selectedDate;
    final isSaved = _savedMovieIds.contains(movie['id']);
    final posterUrl = movie['poster_path'] != null ? 'https://image.tmdb.org/t/p/w300${movie['poster_path']}' : null;
    final backdropUrl = movie['backdrop_path'] != null ? 'https://image.tmdb.org/t/p/w780${movie['backdrop_path']}' : null;
    final voteAvg = movie['vote_average'];
    final dateFormat = DateFormat('dd/MM/yyyy', 'pt_BR');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Scaffold(
              backgroundColor: Colors.transparent,
              resizeToAvoidBottomInset: true,
              body: Align(
                alignment: Alignment.bottomCenter,
                child: FractionallySizedBox(
                  heightFactor: 0.9,
                  child: Container(
                    decoration: const BoxDecoration(
                      color: Color(0xFF0D0D1A),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                    ),
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // === HEADER COM BACKDROP ===
                          SizedBox(
                            height: 260,
                            child: Stack(
                            children: [
                              if (backdropUrl != null)
                                Positioned.fill(
                                  child: ClipRRect(
                                    borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                                    child: CachedNetworkImage(
                                      imageUrl: backdropUrl,
                                      fit: BoxFit.cover,
                                      maxWidthDiskCache: 780,
                                      maxHeightDiskCache: 440,
                                    ),
                                  ),
                                )
                              else
                                Positioned.fill(
                                  child: Container(
                                    decoration: const BoxDecoration(
                                      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                                      gradient: LinearGradient(
                                        begin: Alignment.topCenter,
                                        end: Alignment.bottomCenter,
                                        colors: [Color(0xFF1A1A3E), Color(0xFF0D0D1A)],
                                      ),
                                    ),
                                  ),
                                ),
                              Positioned.fill(
                                child: Container(
                                  decoration: BoxDecoration(
                                    borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                                    gradient: LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [
                                        Colors.transparent,
                                        const Color(0xFF0D0D1A).withValues(alpha: 0.6),
                                        const Color(0xFF0D0D1A),
                                      ],
                                      stops: const [0.0, 0.6, 1.0],
                                    ),
                                  ),
                                ),
                              ),
                              Positioned(
                                top: 10, left: 0, right: 0,
                                child: Center(
                                  child: Container(
                                    width: 40, height: 4,
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.4),
                                      borderRadius: BorderRadius.circular(2),
                                    ),
                                  ),
                                ),
                              ),
                              Positioned(
                                bottom: 0, left: 16, right: 16,
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    if (posterUrl != null)
                                      Container(
                                        decoration: BoxDecoration(
                                          borderRadius: BorderRadius.circular(12),
                                          boxShadow: [
                                            BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 16, offset: const Offset(0, 8)),
                                          ],
                                        ),
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(12),
                                          child: CachedNetworkImage(
                                            imageUrl: posterUrl,
                                            width: 100, height: 150,
                                            fit: BoxFit.cover,
                                            maxWidthDiskCache: 200,
                                            maxHeightDiskCache: 300,
                                          ),
                                        ),
                                      ),
                                    const SizedBox(width: 16),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            movie['title'] ?? 'Sem título',
                                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white, height: 1.2),
                                            maxLines: 3, overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 8),
                                          Row(children: [
                                            if (voteAvg != null) ...[
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                decoration: BoxDecoration(
                                                  color: Colors.amber.withValues(alpha: 0.15),
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                                  const Icon(Icons.star_rounded, size: 16, color: Colors.amber),
                                                  const SizedBox(width: 3),
                                                  Text('${(voteAvg as num).toStringAsFixed(1)}', style: const TextStyle(color: Colors.amber, fontSize: 13, fontWeight: FontWeight.w700)),
                                                ]),
                                              ),
                                            ],
                                          ]),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),

                        // === SINOPSE ===
                        if (movie['overview'] != null && movie['overview'].toString().isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(children: [
                                  Container(width: 3, height: 18, decoration: BoxDecoration(color: const Color(0xFF007bff), borderRadius: BorderRadius.circular(2))),
                                  const SizedBox(width: 8),
                                  const Text('Sinopse', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 16)),
                                ]),
                                const SizedBox(height: 10),
                                Text(
                                  movie['overview'],
                                  style: TextStyle(color: Colors.grey[300], fontSize: 14, height: 1.5),
                                ),
                              ],
                            ),
                          ),

                        // === FORM DE SALVAR (Só se não estiver salvo) ===
                        if (!isSaved) ...[
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(children: [
                                  Container(width: 3, height: 18, decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(2))),
                                  const SizedBox(width: 8),
                                  const Text('Opções de Agendamento', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 16)),
                                ]),
                                const SizedBox(height: 12),
                                TextField(
                                  controller: requestedByController,
                                  decoration: InputDecoration(
                                    labelText: 'Resgatado por (Opcional)',
                                    labelStyle: TextStyle(color: Colors.grey[500]),
                                    prefixIcon: const Icon(Icons.person_outline, color: Color(0xFF5DADE2), size: 20),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1))),
                                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
                                    filled: true,
                                    fillColor: const Color(0xFF141428),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                GestureDetector(
                                  onTap: () async {
                                    final DateTime? picked = await showDatePicker(
                                      context: context,
                                      initialDate: DateTime.now(),
                                      firstDate: DateTime(2000),
                                      lastDate: DateTime(2101),
                                    );
                                    if (picked != null) {
                                      setModalState(() => selectedDate = picked);
                                    }
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF141428),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                                    ),
                                    child: Row(children: [
                                      Icon(
                                        selectedDate != null ? Icons.event_available : Icons.event_note,
                                        color: selectedDate != null ? Colors.green : Colors.grey[500],
                                        size: 20,
                                      ),
                                      const SizedBox(width: 12),
                                      Text(
                                        selectedDate == null ? 'Agendar data (Opcional)' : 'Data: ${dateFormat.format(selectedDate!)}',
                                        style: TextStyle(
                                          color: selectedDate != null ? Colors.white : Colors.grey[500],
                                          fontSize: 15,
                                          fontWeight: selectedDate != null ? FontWeight.w600 : FontWeight.normal,
                                        ),
                                      ),
                                      const Spacer(),
                                      Icon(Icons.chevron_right, color: Colors.grey[600], size: 20),
                                    ]),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 28, 16, 32),
                            child: ElevatedButton(
                              onPressed: () {
                                Navigator.pop(context); // Fecha a modal
                                _saveMovie(movie, requestedByController.text, selectedDate);
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF007bff),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                elevation: 4,
                                shadowColor: const Color(0xFF007bff).withValues(alpha: 0.4),
                              ),
                              child: const Text('Confirmar e Salvar', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            ),
                          ),
                        ] else ...[
                           Padding(
                            padding: const EdgeInsets.all(32),
                            child: Center(
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: Colors.green.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: Colors.green.withValues(alpha: 0.5)),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.check_circle, color: Colors.green),
                                    SizedBox(width: 8),
                                    Text('Este filme já está na sua lista', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
                                  ],
                                ),
                              ),
                            ),
                           )
                        ],
                        const SizedBox(height: 24),
                        SizedBox(height: MediaQuery.of(context).viewInsets.bottom),
                      ],
                    ),
                  ),
                ),
              ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _saveMovie(dynamic movie, String requestedBy, DateTime? watchDate) async {
    try {
      final token = await _storage.read(key: 'token');
      final payload = {
        'title': movie['title'],
        'tmdbId': movie['id'],
        'poster': movie['poster_path'],
        'genre': 'Desconhecido', // Simples para MVP Mobile, depois podemos buscar os IDs dos gêneros
        'requestedBy': requestedBy.trim().isEmpty ? null : requestedBy.trim(),
        'watchDate': watchDate?.toIso8601String(),
      };

      await api.post('/movies', data: payload, options: Options(headers: {'Authorization': 'Bearer $token'}));
      refreshStreamController.add(null);
      
      if (mounted) {
        setState(() => _savedMovieIds.add(movie['id']));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Filme "${movie['title']}" salvo! ✅', style: const TextStyle(color: Colors.white)), backgroundColor: Colors.green),
        );
      }
      
      if (watchDate != null) {
        final dateStr = DateFormat('dd/MM/yyyy', 'pt_BR').format(watchDate);
        NotificationService().showImmediateNotification('Filme Agendado: ${movie['title']}', 'Marcado para: $dateStr. O alarme já está configurado!');
      } else {
        NotificationService().showImmediateNotification('Filme na Fila: ${movie['title']}', 'Adicionado à sua lista, mas ainda sem data definida.');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Erro ao salvar o filme.'), backgroundColor: Colors.red));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              child: TextField(
                controller: _searchController,
                onChanged: _onSearchChanged,
                decoration: InputDecoration(
                  hintText: 'Ex: Batman...',
                  filled: true,
                  fillColor: const Color(0xFF141414),
                  contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  prefixIcon: const Icon(Icons.search, color: Colors.grey),
                  suffixIcon: ValueListenableBuilder<bool>(
                    valueListenable: _hasText,
                    builder: (context, hasText, _) => hasText
                        ? IconButton(
                            icon: const Icon(Icons.clear, color: Colors.grey),
                            onPressed: () {
                              _searchController.clear();
                              _onSearchChanged('');
                            },
                          )
                        : const SizedBox.shrink(),
                  ),
                ),
              ),
            ),
            Expanded(
              child: _movies.isEmpty && _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : GridView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2, // Dois filmes por linha
                childAspectRatio: 0.55, // Proporção para a capa não ficar esmagada
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
              ),
              itemCount: _movies.length + (_hasMore ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == _movies.length) {
                  return const Center(child: CircularProgressIndicator());
                }

                final movie = _movies[index];
                final isSaved = _savedMovieIds.contains(movie['id']);
                final voteAvg = movie['vote_average'];

                return GestureDetector(
                  onTap: () => _showSaveBottomSheet(movie),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      color: const Color(0xFF1A1A2E),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.3),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Poster com overlay gradient e badge de rating
                        Expanded(
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              CachedNetworkImage(
                                imageUrl: 'https://image.tmdb.org/t/p/w200${movie['poster_path']}',
                                fit: BoxFit.cover,
                                maxWidthDiskCache: 240,
                                maxHeightDiskCache: 360,
                                placeholder: (context, url) => Container(
                                  color: Colors.grey[850],
                                  child: const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
                                ),
                                errorWidget: (context, url, error) => Container(
                                  color: Colors.grey[800],
                                  child: const Icon(Icons.broken_image, size: 50, color: Colors.grey),
                                ),
                              ),
                              // Gradient overlay na parte inferior
                              Positioned(
                                bottom: 0, left: 0, right: 0,
                                child: Container(
                                  height: 60,
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [Colors.transparent, Colors.black.withValues(alpha: 0.8)],
                                    ),
                                  ),
                                ),
                              ),
                              // Badge de rating TMDB
                              if (voteAvg != null && voteAvg > 0)
                                Positioned(
                                  top: 8, right: 8,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: Colors.black.withValues(alpha: 0.7),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                                      const Icon(Icons.star_rounded, size: 14, color: Colors.amber),
                                      const SizedBox(width: 2),
                                      Text(
                                        (voteAvg as num).toStringAsFixed(1),
                                        style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.w700),
                                      ),
                                    ]),
                                  ),
                                ),
                              // Badge de "já salvo"
                              if (isSaved)
                                Positioned(
                                  top: 8, left: 8,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: Colors.green.withValues(alpha: 0.85),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: const Row(mainAxisSize: MainAxisSize.min, children: [
                                      Icon(Icons.check_circle, size: 12, color: Colors.white),
                                      SizedBox(width: 3),
                                      Text('Na lista', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600)),
                                    ]),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        // Título e botão
                        Padding(
                          padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                movie['title'] ?? 'Sem título',
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Colors.white),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 8),
                              if (!isSaved)
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton(
                                    onPressed: () => _showSaveBottomSheet(movie),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF007bff),
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(vertical: 8),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                      elevation: 2,
                                      shadowColor: const Color(0xFF007bff).withValues(alpha: 0.3),
                                    ),
                                    child: const Text('Salvar', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            ),
          ],
        ),
      ),
    );
  }
}
