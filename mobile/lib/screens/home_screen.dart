import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api.dart';
import '../services/notification_service.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:intl/intl.dart';

import 'package:cached_network_image/cached_network_image.dart';

class HomeScreen extends StatefulWidget {
  final Function(int) onNavigate;
  const HomeScreen({super.key, required this.onNavigate});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  final _storage = const FlutterSecureStorage();
  List<dynamic> _movies = [];
  bool _isLoading = true;
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;
  late final TabController _tabController;
  StreamSubscription? _refreshSubscription;
  bool _isSelfUpdate = false;

  // Search and Filter State
  String _searchQuery = '';
  String _selectedFilter = 'Todos'; // 'Todos', 'Assistidos', 'Não Assistidos', 'Com Resgate'
  final TextEditingController _searchController = TextEditingController();

  // Pre-computed filtered lists (recalculated on each fetch)
  List<dynamic> _todayMovies = [];
  List<dynamic> _weekMovies = [];
  List<dynamic> _noDateMovies = [];
  Map<DateTime, List<dynamic>> _eventsByDay = {};

  // Cached DateFormat instances (avoid re-instantiation in itemBuilder)
  final DateFormat _dateFormatWeekday = DateFormat('EEEE, dd/MM', 'pt_BR');
  final DateFormat _dateFormatFull = DateFormat('dd/MM/yyyy', 'pt_BR');
  final DateFormat _dateFormatMonth = DateFormat('MMMM yyyy', 'pt_BR');

  @override
  void initState() {
    super.initState();
    
    _tabController = TabController(length: 4, vsync: this);

    _fetchMovies();

    _refreshSubscription = refreshStreamController.stream.listen((_) {
      if (!_isSelfUpdate) {
        _fetchMovies();
      }
      _isSelfUpdate = false;
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    _refreshSubscription?.cancel();
    super.dispose();
  }

  Future<void> _loadCachedMovies() async {
    final prefs = await SharedPreferences.getInstance();
    final cachedData = prefs.getString('cached_movies');
    if (cachedData != null) {
      if (mounted) {
        setState(() {
          _movies = jsonDecode(cachedData);
          _computeFilteredLists();
          _isLoading = false;
        });
        // Sincroniza notificações com os dados cacheados (Offline First)
        NotificationService().syncMovieNotifications(_movies);
      }
    }
  }

  Future<void> _fetchMovies() async {
    try {
      await _loadCachedMovies(); // Mostra do cache instantaneamente (Offline First)
      
      final token = await _storage.read(key: 'token');
      // Faz a requisição enviando o Token no Header de Autorização
      final response = await api.get(
        '/movies',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      // Salva os filmes novos no cache
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cached_movies', jsonEncode(response.data));

      if (!mounted) return;
      setState(() {
        _movies = response.data;
        _computeFilteredLists();
        _isLoading = false;
      });
      // Sincroniza notificações locais com os dados mais recentes da API
      NotificationService().syncMovieNotifications(_movies);
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        if (_movies.isNotEmpty) {
           ScaffoldMessenger.of(context).showSnackBar(
             const SnackBar(content: Text('Modo Offline: Mostrando filmes salvos. ⚡', style: TextStyle(color: Colors.white)), backgroundColor: Colors.orange),
           );
        } else {
           ScaffoldMessenger.of(context).showSnackBar(
             const SnackBar(content: Text('Sem conexão e sem dados salvos.', style: TextStyle(color: Colors.white)), backgroundColor: Colors.red),
           );
        }
      }
    }
  }

  Future<void> _updateMovie(int movieId, Map<String, dynamic> data) async {
    // Atualização otimista na UI
    setState(() {
      _movies = _movies.map((movie) {
        if (movie['id'] == movieId) {
          return {...movie, ...data};
        }
        return movie;
      }).toList();
      _computeFilteredLists();
    });
    // Atualiza notificações após alteração local otimista
    NotificationService().syncMovieNotifications(_movies);

    try {
      final token = await _storage.read(key: 'token');
      await api.put(
        '/movies/$movieId',
        data: data,
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      _isSelfUpdate = true;
      refreshStreamController.add(null);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Erro ao atualizar filme.'), backgroundColor: Colors.red));
        _fetchMovies(); // Reverte para o estado do servidor em caso de erro
      }
    }
  }

  Future<void> _deleteMovie(int movieId) async {
    // Remoção otimista da UI
    final backup = List<dynamic>.from(_movies);
    setState(() {
      _movies.removeWhere((m) => m['id'] == movieId);
      _computeFilteredLists();
    });
    // Remove as notificações relativas ao filme excluído
    NotificationService().cancelMovieNotification(movieId);

    try {
      final token = await _storage.read(key: 'token');
      await api.delete(
        '/movies/$movieId', options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      _isSelfUpdate = true;
      refreshStreamController.add(null);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Filme removido!'), backgroundColor: Colors.orange));
      }
    } catch (e) {
      if (mounted) {
        // Reverte para o estado anterior em caso de erro
        setState(() {
          _movies = backup;
          _computeFilteredLists();
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Erro ao remover filme.'), backgroundColor: Colors.red));
      }
    }
  }


  List<dynamic> _getEventsForDay(DateTime day) {
    final key = DateTime.utc(day.year, day.month, day.day);
    return _eventsByDay[key] ?? [];
  }

  /// Pré-computa as listas filtradas e o mapa de eventos do calendário.
  /// Chamado apenas quando `_movies` muda, evitando recálculo a cada build.
  void _computeFilteredLists() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final endOfWeek = today.add(const Duration(days: 6));

    final query = _searchQuery.toLowerCase();
    final filteredBaseMovies = _movies.where((movie) {
      final title = (movie['title'] ?? '').toLowerCase();
      if (query.isNotEmpty && !title.contains(query)) {
        return false;
      }
      if (_selectedFilter == 'Assistidos' && movie['watched'] != true) return false;
      if (_selectedFilter == 'Não Assistidos' && movie['watched'] == true) return false;
      if (_selectedFilter == 'Com Resgate' && (movie['requestedBy'] == null || movie['requestedBy'].isEmpty)) return false;
      return true;
    }).toList();

    _todayMovies = filteredBaseMovies.where((movie) {
      if (movie['watchDate'] == null) return false;
      final watchDate = DateTime.parse(movie['watchDate']);
      final movieDay = DateTime(watchDate.year, watchDate.month, watchDate.day);
      return isSameDay(movieDay, today);
    }).toList();

    _weekMovies = filteredBaseMovies.where((movie) {
      if (movie['watchDate'] == null) return false;
      final watchDate = DateTime.parse(movie['watchDate']);
      final movieDay = DateTime(watchDate.year, watchDate.month, watchDate.day);
      return !movieDay.isBefore(today) && !movieDay.isAfter(endOfWeek);
    }).toList();

    _noDateMovies = filteredBaseMovies.where((movie) => movie['watchDate'] == null).toList();

    // Ordena as listas
    _sortMovieList(_todayMovies);
    _sortMovieList(_weekMovies);
    _noDateMovies.sort((a, b) => (a['id'] as int).compareTo(b['id'] as int));

    // Pré-computa mapa de eventos para o calendário (lookup O(1) por dia)
    _eventsByDay = {};
    for (final movie in filteredBaseMovies) {
      if (movie['watchDate'] == null) continue;
      final watchDate = DateTime.parse(movie['watchDate']);
      final key = DateTime.utc(watchDate.year, watchDate.month, watchDate.day);
      _eventsByDay.putIfAbsent(key, () => []).add(movie);
    }
  }

  void _sortMovieList(List<dynamic> list) {
    list.sort((a, b) {
      if (a['watchDate'] == null && b['watchDate'] == null) {
        return (a['id'] as int).compareTo(b['id'] as int);
      }
      if (a['watchDate'] == null) return 1;
      if (b['watchDate'] == null) return -1;
      final dateA = DateTime.parse(a['watchDate']);
      final dateB = DateTime.parse(b['watchDate']);
      final dateComparison = dateA.compareTo(dateB);
      if (dateComparison != 0) return dateComparison;
      return (a['id'] as int).compareTo(b['id'] as int);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A), // Define a clean background color for the screen
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _fetchMovies,
                child: Column(
                  children: [
                    _buildSearchBar(),
                    _buildViewModeToggle(),
                    Expanded(child: _buildCurrentView()),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _searchController,
              onChanged: (val) {
                setState(() {
                  _searchQuery = val;
                  _computeFilteredLists();
                });
              },
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Buscar...',
                hintStyle: TextStyle(color: Colors.grey[500], fontSize: 14),
                prefixIcon: Icon(Icons.search, color: Colors.grey[400], size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: Colors.grey, size: 20),
                        onPressed: () {
                          _searchController.clear();
                          setState(() {
                            _searchQuery = '';
                            _computeFilteredLists();
                          });
                        },
                      )
                    : null,
                filled: true,
                fillColor: const Color(0xFF1A1A2E),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            height: 48, // Alinhar com a altura do TextField
            decoration: BoxDecoration(
              color: const Color(0xFF1A1A2E),
              borderRadius: BorderRadius.circular(12),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedFilter,
                dropdownColor: const Color(0xFF222222),
                icon: Icon(Icons.filter_list, color: Colors.grey[400], size: 20),
                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                onChanged: (String? newValue) {
                  if (newValue != null) {
                    setState(() {
                      _selectedFilter = newValue;
                      _computeFilteredLists();
                    });
                  }
                },
                items: <String>['Todos', 'Assistidos', 'Não Assistidos', 'Com Resgate']
                    .map<DropdownMenuItem<String>>((String value) {
                  return DropdownMenuItem<String>(
                    value: value,
                    child: Text(value),
                  );
                }).toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildViewModeToggle() {
    return Container(
      color: const Color(0xFF181818),
      child: TabBar(
        controller: _tabController,
        isScrollable: true,
        indicatorColor: const Color(0xFF007bff),
        indicatorWeight: 3,
        labelColor: Colors.white,
        unselectedLabelColor: Colors.grey[600],
        dividerColor: Colors.transparent,
        tabAlignment: TabAlignment.center,
        tabs: const [
          Tab(icon: Icon(Icons.today, size: 20), text: 'Hoje'),
          Tab(icon: Icon(Icons.view_week, size: 20), text: 'Semana'),
          Tab(icon: Icon(Icons.calendar_month, size: 20), text: 'Mês'),
          Tab(icon: Icon(Icons.playlist_play, size: 20), text: 'Sem Data'),
        ],
      ),
    );
  }

  Widget _buildCurrentView() {
    return TabBarView(
      controller: _tabController,
      children: [
        _buildMoviesList(mode: 'HOJE'),
        _buildMoviesList(mode: 'SEMANA'),
        _buildCalendarView(),
        _buildMoviesList(mode: 'SEM_DATA'),
      ],
    );
  }

  Widget _buildMoviesList({required String mode}) {
    // Usa listas pré-computadas em vez de filtrar/ordenar a cada rebuild
    final List<dynamic> moviesToShow;
    switch (mode) {
      case 'SEMANA':
        moviesToShow = _weekMovies;
        break;
      case 'SEM_DATA':
        moviesToShow = _noDateMovies;
        break;
      default:
        moviesToShow = _todayMovies;
    }

    if (moviesToShow.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                mode == 'SEM_DATA'
                    ? 'Nenhum filme na fila (sem data).'
                    : 'Nenhum filme agendado para ${mode == 'SEMANA' ? 'esta semana' : 'hoje'}.',
                style: TextStyle(color: Colors.grey[600], fontSize: 18),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                icon: const Icon(Icons.add_to_queue),
                label: const Text('Agendar um Filme'),
                onPressed: () => widget.onNavigate(1), // Navega para a busca (índice 1)
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: moviesToShow.length,
      itemBuilder: (context, index) {
        final movie = moviesToShow[index];

        return _buildMovieCard(movie);
      },
    );
  }

  Widget _buildMovieCard(dynamic movie) {
    final Color accentColor = movie['watched']
        ? Colors.green
        : (movie['watchDate'] != null ? const Color(0xFF007bff) : Colors.grey[700]!);

    return Dismissible(
      key: Key('movie_${movie['id']}'),
      background: Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(14)),
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: const Icon(Icons.check_circle_outline, color: Colors.white, size: 30),
      ),
      secondaryBackground: Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(14)),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: const Icon(Icons.delete_forever, color: Colors.white, size: 30),
      ),
      confirmDismiss: (direction) async {
        if (direction == DismissDirection.startToEnd) {
          bool? confirm = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              backgroundColor: const Color(0xFF222222),
              title: Text(movie['watched'] ? 'Desmarcar como Assistido?' : 'Marcar como Assistido?', style: const TextStyle(color: Colors.white)),
              content: Text(
                movie['watched'] ? 'Deseja remover "${movie['title']}" dos assistidos?' : 'Deseja marcar "${movie['title']}" como assistido?', 
                style: const TextStyle(color: Colors.grey)
              ),
              actions: [
                TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancelar', style: TextStyle(color: Colors.grey))),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                  onPressed: () => Navigator.of(ctx).pop(true), 
                  child: const Text('Confirmar', style: TextStyle(color: Colors.white))
                ),
              ],
            )
          );
          if (confirm == true) {
            _updateMovie(movie['id'], {'watched': !movie['watched']});
          }
          return false;
        } else {
          bool? confirm = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              backgroundColor: const Color(0xFF222222),
              title: const Text('Excluir Filme?', style: TextStyle(color: Colors.red)),
              content: Text('Tem certeza que deseja remover "${movie['title']}" da agenda?', style: const TextStyle(color: Colors.grey)),
              actions: [
                TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancelar', style: TextStyle(color: Colors.grey))),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                  onPressed: () => Navigator.of(ctx).pop(true), 
                  child: const Text('Excluir', style: TextStyle(color: Colors.white))
                ),
              ],
            )
          );
          if (confirm == true) {
            _deleteMovie(movie['id']);
            return true;
          }
          return false;
        }
      },
      child: GestureDetector(
        onTap: () => _showMovieDetailsBottomSheet(movie),
        child: Container(
          margin: const EdgeInsets.only(bottom: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: const Color(0xFF1A1A2E),
            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
            boxShadow: [
              BoxShadow(
                color: accentColor.withValues(alpha: 0.08),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: IntrinsicHeight(
            child: Row(
              children: [
                // Acento lateral colorido
                Container(
                  width: 4,
                  decoration: BoxDecoration(
                    color: accentColor,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(14),
                      bottomLeft: Radius.circular(14),
                    ),
                  ),
                ),
                // Poster
                Padding(
                  padding: const EdgeInsets.all(10),
                  child: movie['poster'] != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: CachedNetworkImage(
                            imageUrl: 'https://image.tmdb.org/t/p/w200${movie['poster']}',
                            width: 65,
                            height: 98,
                            fit: BoxFit.cover,
                            maxWidthDiskCache: 130,
                            maxHeightDiskCache: 196,
                            placeholder: (context, url) => Container(
                              width: 65, height: 98,
                              decoration: BoxDecoration(color: Colors.grey[850], borderRadius: BorderRadius.circular(10)),
                            ),
                            errorWidget: (context, url, error) =>
                                Container(width: 65, height: 98, color: Colors.grey[800], child: const Icon(Icons.movie, color: Colors.grey)),
                          ),
                        )
                      : Container(
                          width: 65, height: 98,
                          decoration: BoxDecoration(color: Colors.grey[800], borderRadius: BorderRadius.circular(10)),
                          child: const Icon(Icons.movie, color: Colors.grey, size: 32),
                        ),
                ),
                const SizedBox(width: 4),
                // Info
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          movie['title'],
                          style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 15),
                          maxLines: 2, overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        if (movie['watchDate'] != null)
                          Row(children: [
                            Icon(Icons.calendar_today, size: 13, color: Colors.green[300]),
                            const SizedBox(width: 5),
                            Text(
                              _dateFormatWeekday.format(DateTime.parse(movie['watchDate'])),
                              style: TextStyle(color: Colors.green[300], fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ])
                        else
                          Row(children: [
                            Icon(Icons.schedule, size: 13, color: Colors.grey[500]),
                            const SizedBox(width: 5),
                            Text('Sem data agendada', style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                          ]),
                        if (movie['requestedBy'] != null && movie['requestedBy'].isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Row(children: [
                            const Icon(Icons.person_outline, size: 13, color: Color(0xFF5DADE2)),
                            const SizedBox(width: 5),
                            Expanded(
                              child: Text(
                                movie['requestedBy'],
                                style: const TextStyle(color: Color(0xFF5DADE2), fontSize: 12),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ]),
                        ],
                        if (movie['streamerRating'] != null || movie['chatRating'] != null) ...[
                          const SizedBox(height: 4),
                          Row(children: [
                            if (movie['streamerRating'] != null) ...[
                              const Icon(Icons.star_rounded, size: 14, color: Colors.amber),
                              const SizedBox(width: 3),
                              Text('${movie['streamerRating']}', style: const TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.w600)),
                              const SizedBox(width: 10),
                            ],
                            if (movie['chatRating'] != null) ...[
                              const Icon(Icons.chat_bubble_outline, size: 13, color: Colors.purpleAccent),
                              const SizedBox(width: 3),
                              Text('${movie['chatRating']}', style: const TextStyle(color: Colors.purpleAccent, fontSize: 12, fontWeight: FontWeight.w600)),
                            ],
                          ]),
                        ],
                      ],
                    ),
                  ),
                ),
                // Actions
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    movie['watched']
                        ? const Icon(Icons.check_circle_rounded, color: Colors.green, size: 22)
                        : Icon(Icons.radio_button_unchecked, color: Colors.grey[600], size: 22),
                    PopupMenuButton<String>(
                      icon: Icon(Icons.more_vert, color: Colors.grey[500], size: 20),
                      onSelected: (String result) {
                        if (result == 'unschedule') {
                          _updateMovie(movie['id'], {'watchDate': null});
                        } else if (result == 'delete') {
                          _deleteMovie(movie['id']);
                        } else if (result == 'toggle_watched') {
                          _updateMovie(movie['id'], {'watched': !movie['watched']});
                        }
                      },
                      itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
                        PopupMenuItem<String>(
                          value: 'toggle_watched',
                          child: ListTile(
                            leading: Icon(movie['watched'] ? Icons.remove_done : Icons.check_circle_outline, color: Colors.green),
                            title: Text(movie['watched'] ? 'Marcar como Não Visto' : 'Marcar como Assistido'),
                          ),
                        ),
                        if (movie['watchDate'] != null)
                          const PopupMenuItem<String>(
                            value: 'unschedule',
                            child: ListTile(
                              leading: Icon(Icons.event_busy, color: Colors.orangeAccent),
                              title: Text('Remover da Agenda', style: TextStyle(color: Colors.orangeAccent)),
                            ),
                          ),
                        const PopupMenuItem<String>(
                          value: 'delete',
                          child: ListTile(
                            leading: Icon(Icons.delete_forever, color: Colors.redAccent),
                            title: Text('Excluir Filme', style: TextStyle(color: Colors.redAccent)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(width: 4),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCalendarView() {
    final List<dynamic> moviesToShow;
    final String listTitle;
    final bool isFilterActive = _selectedDay != null;

    if (isFilterActive) {
      moviesToShow = _getEventsForDay(_selectedDay!);
      listTitle = 'Filmes de ${_dateFormatFull.format(_selectedDay!)}';
    } else {
      moviesToShow = _movies.where((movie) {
        if (movie['watchDate'] == null) return false;
        final watchDate = DateTime.parse(movie['watchDate']);
        return watchDate.year == _focusedDay.year && watchDate.month == _focusedDay.month;
      }).toList();
      moviesToShow.sort((a, b) => DateTime.parse(a['watchDate']).compareTo(DateTime.parse(b['watchDate'])));
      
      // Formata a primeira letra do mês para maiúscula
      final rawMonthStr = _dateFormatMonth.format(_focusedDay);
      listTitle = 'Filmes de ${rawMonthStr.substring(0, 1).toUpperCase()}${rawMonthStr.substring(1)}';
    }

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            elevation: 4,
            color: const Color(0xFF222222),
            child: TableCalendar(
              locale: 'pt_BR',
              firstDay: DateTime.utc(2020, 1, 1),
              lastDay: DateTime.utc(2030, 12, 31),
              focusedDay: _focusedDay,
              calendarFormat: CalendarFormat.month,
              eventLoader: _getEventsForDay,
              selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
              onDaySelected: (selectedDay, focusedDay) {
                setState(() {
                  // Se clicar no dia já selecionado, limpa o filtro
                  if (isSameDay(_selectedDay, selectedDay)) {
                    _selectedDay = null;
                  } else {
                    _selectedDay = selectedDay;
                  }
                  _focusedDay = focusedDay;
                });
              },
              onPageChanged: (focusedDay) {
                setState(() {
                  _focusedDay = focusedDay;
                  _selectedDay = null; // Limpa seleção ao trocar de mês
                });
              },
              availableGestures: AvailableGestures.none,
              calendarStyle: CalendarStyle(
                defaultTextStyle: const TextStyle(color: Colors.white),
                weekendTextStyle: const TextStyle(color: Colors.white70),
                outsideTextStyle: const TextStyle(color: Colors.white30),
                todayDecoration: BoxDecoration(
                  color: const Color(0xFF007bff).withOpacity(0.5),
                  shape: BoxShape.circle,
                ),
                selectedDecoration: const BoxDecoration(
                  color: Color(0xFF007bff),
                  shape: BoxShape.circle,
                ),
                markerDecoration: const BoxDecoration(
                  color: Colors.amber,
                  shape: BoxShape.circle,
                ),
              ),
              headerStyle: const HeaderStyle(
                formatButtonVisible: false,
                titleCentered: true,
                titleTextStyle: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                leftChevronIcon: Icon(Icons.chevron_left, color: Colors.white),
                rightChevronIcon: Icon(Icons.chevron_right, color: Colors.white),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    listTitle,
                    style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
                if (isFilterActive)
                  TextButton.icon(
                    icon: const Icon(Icons.clear, size: 16, color: Color(0xFF007bff)),
                    label: const Text('Ver Mês Inteiro', style: TextStyle(color: Color(0xFF007bff))),
                    onPressed: () {
                      setState(() {
                        _selectedDay = null;
                      });
                    },
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          if (moviesToShow.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24.0),
              child: Text(
                isFilterActive ? 'Nenhum filme neste dia.' : 'Nenhum filme agendado para este mês.',
                style: TextStyle(color: Colors.grey[600], fontSize: 14),
                textAlign: TextAlign.center,
              ),
            )
          else
            ...moviesToShow.map((movie) => _buildMovieCard(movie)),
        ],
      ),
    );
  }

  Future<void> _showMovieDetailsBottomSheet(dynamic movie) async {

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _MovieDetailsContent(
        movie: movie,
        onSave: (updates) => _updateMovie(movie['id'], updates),
      ),
    );
  }

}

class _MovieDetailsContent extends StatefulWidget {
  final dynamic movie;
  final Function(Map<String, dynamic>) onSave;

  const _MovieDetailsContent({required this.movie, required this.onSave});

  @override
  State<_MovieDetailsContent> createState() => _MovieDetailsContentState();
}

class _MovieDetailsContentState extends State<_MovieDetailsContent> {
  final _storage = const FlutterSecureStorage();
  late final TextEditingController _streamerRatingController;
  late final TextEditingController _chatRatingController;
  DateTime? _selectedDate;

  bool _isLoadingTmdb = true;
  Map<String, dynamic>? _tmdbData;

  @override
  void initState() {
    super.initState();
    _streamerRatingController = TextEditingController(text: widget.movie['streamerRating']?.toString() ?? '');
    _chatRatingController = TextEditingController(text: widget.movie['chatRating']?.toString() ?? '');
    _selectedDate = widget.movie['watchDate'] != null ? DateTime.parse(widget.movie['watchDate']) : null;
    _fetchTmdbDetails();
  }

  Future<void> _fetchTmdbDetails() async {
    if (widget.movie['tmdbId'] == null) {
      setState(() => _isLoadingTmdb = false);
      return;
    }
    try {
      final token = await _storage.read(key: 'token');
      final response = await api.get('/movies/tmdb/${widget.movie['tmdbId']}', options: Options(headers: {'Authorization': 'Bearer $token'}));
      if (mounted) {
        setState(() {
          _tmdbData = response.data;
          _isLoadingTmdb = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoadingTmdb = false);
    }
  }

  @override
  void dispose() {
    _streamerRatingController.dispose();
    _chatRatingController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final posterUrl = widget.movie['poster'] != null ? 'https://image.tmdb.org/t/p/w300${widget.movie['poster']}' : null;
    final backdropUrl = _tmdbData != null && _tmdbData!['backdrop_path'] != null
        ? 'https://image.tmdb.org/t/p/w780${_tmdbData!['backdrop_path']}'
        : null;
    final tmdbRating = _tmdbData?['vote_average'];
    final genres = (_tmdbData?['genres'] as List<dynamic>?)?.map((g) => g['name'] as String).toList() ?? [];
    final runtime = _tmdbData?['runtime'];
    final dateFormat = DateFormat('dd/MM/yyyy', 'pt_BR');

    return Scaffold(
      backgroundColor: Colors.transparent,
      resizeToAvoidBottomInset: true,
      body: Align(
        alignment: Alignment.bottomCenter,
        child: FractionallySizedBox(
          heightFactor: 0.9, // Covers 90% of screen
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
                      // Backdrop
                      if (backdropUrl != null)
                        Positioned.fill(
                          child: ClipRRect(
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                            child: CachedNetworkImage(
                              imageUrl: backdropUrl,
                              fit: BoxFit.cover,
                              maxWidthDiskCache: 780,
                              maxHeightDiskCache: 440,
                              placeholder: (context, url) => Container(color: const Color(0xFF1A1A2E)),
                              errorWidget: (context, url, error) => Container(color: const Color(0xFF1A1A2E)),
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
                      // Gradient overlay
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
                      // Drag handle
                      Positioned(
                        top: 10,
                        left: 0,
                        right: 0,
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
                      // Poster + Title
                      Positioned(
                        bottom: 0,
                        left: 16,
                        right: 16,
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
                                    placeholder: (context, url) => Container(width: 100, height: 150, color: Colors.grey[850]),
                                    errorWidget: (context, url, error) => Container(
                                      width: 100, height: 150, color: Colors.grey[800],
                                      child: const Icon(Icons.movie, color: Colors.grey, size: 40),
                                    ),
                                  ),
                                ),
                              ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    widget.movie['title'] ?? 'Sem título',
                                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white, height: 1.2),
                                    maxLines: 3, overflow: TextOverflow.ellipsis,
                                  ),
                                  if (widget.movie['requestedBy'] != null && widget.movie['requestedBy'].toString().isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Row(children: [
                                      const Icon(Icons.person_outline, size: 14, color: Color(0xFF5DADE2)),
                                      const SizedBox(width: 4),
                                      Text('Resgate: ${widget.movie['requestedBy']}', style: const TextStyle(color: Color(0xFF5DADE2), fontSize: 13, fontWeight: FontWeight.w600)),
                                    ]),
                                  ],
                                  const SizedBox(height: 8),
                                  // TMDB Rating + Runtime
                                  if (!_isLoadingTmdb) Row(children: [
                                    if (tmdbRating != null) ...[
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: Colors.amber.withValues(alpha: 0.15),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                                          const Icon(Icons.star_rounded, size: 16, color: Colors.amber),
                                          const SizedBox(width: 3),
                                          Text('${(tmdbRating as num).toStringAsFixed(1)}', style: const TextStyle(color: Colors.amber, fontSize: 13, fontWeight: FontWeight.w700)),
                                        ]),
                                      ),
                                      const SizedBox(width: 8),
                                    ],
                                    if (runtime != null)
                                      Row(mainAxisSize: MainAxisSize.min, children: [
                                        Icon(Icons.schedule, size: 14, color: Colors.grey[400]),
                                        const SizedBox(width: 4),
                                        Text('$runtime min', style: TextStyle(color: Colors.grey[400], fontSize: 12)),
                                      ]),
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

                // === GENRE CHIPS ===
                if (genres.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: genres.map((genre) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFF007bff).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFF007bff).withValues(alpha: 0.3)),
                        ),
                        child: Text(genre, style: const TextStyle(color: Color(0xFF5DADE2), fontSize: 12, fontWeight: FontWeight.w500)),
                      )).toList(),
                    ),
                  ),

                // === SINOPSE ===
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
                      if (_isLoadingTmdb)
                        const Text('Carregando...', style: TextStyle(color: Colors.grey))
                      else
                        Text(
                          _tmdbData != null && _tmdbData!['overview'] != null && _tmdbData!['overview'].toString().isNotEmpty
                              ? _tmdbData!['overview']
                              : 'Nenhuma sinopse disponível.',
                          style: TextStyle(color: Colors.grey[300], fontSize: 14, height: 1.5),
                        ),
                    ],
                  ),
                ),

                // === AGENDAMENTO ===
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Container(width: 3, height: 18, decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(2))),
                        const SizedBox(width: 8),
                        const Text('Agendamento', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 16)),
                      ]),
                      const SizedBox(height: 10),
                      GestureDetector(
                        onTap: () async {
                          final DateTime? picked = await showDatePicker(
                            context: context,
                            initialDate: _selectedDate ?? DateTime.now(),
                            firstDate: DateTime(2000),
                            lastDate: DateTime(2101),
                          );
                          if (picked != null) {
                            setState(() => _selectedDate = picked);
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
                              _selectedDate != null ? Icons.event_available : Icons.event_note,
                              color: _selectedDate != null ? Colors.green : Colors.grey[500],
                              size: 20,
                            ),
                            const SizedBox(width: 12),
                            Text(
                              _selectedDate == null ? 'Toque para agendar uma data' : dateFormat.format(_selectedDate!),
                              style: TextStyle(
                                color: _selectedDate != null ? Colors.white : Colors.grey[500],
                                fontSize: 15,
                                fontWeight: _selectedDate != null ? FontWeight.w600 : FontWeight.normal,
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

                // === AVALIAÇÕES ===
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Container(width: 3, height: 18, decoration: BoxDecoration(color: Colors.amber, borderRadius: BorderRadius.circular(2))),
                        const SizedBox(width: 8),
                        const Text('Avaliações', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 16)),
                      ]),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _streamerRatingController,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: InputDecoration(
                                labelText: 'Minha Nota',
                                labelStyle: TextStyle(color: Colors.grey[500]),
                                prefixIcon: const Icon(Icons.star_rounded, color: Colors.amber, size: 20),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1))),
                                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
                                filled: true,
                                fillColor: const Color(0xFF141428),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextField(
                              controller: _chatRatingController,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: InputDecoration(
                                labelText: 'Nota do Chat',
                                labelStyle: TextStyle(color: Colors.grey[500]),
                                prefixIcon: const Icon(Icons.chat_bubble_outline, color: Colors.purpleAccent, size: 20),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1))),
                                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
                                filled: true,
                                fillColor: const Color(0xFF141428),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // === BOTÃO SALVAR ===
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 28, 16, 32),
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      widget.onSave({
                        'streamerRating': double.tryParse(_streamerRatingController.text.replaceAll(',', '.')),
                        'chatRating': double.tryParse(_chatRatingController.text.replaceAll(',', '.')),
                        'watchDate': _selectedDate?.toIso8601String(),
                      });
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF007bff),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 4,
                      shadowColor: const Color(0xFF007bff).withValues(alpha: 0.4),
                    ),
                    child: const Text('Salvar Alterações', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  ),
                ),
                SizedBox(height: MediaQuery.of(context).viewInsets.bottom),
              ],
            ),
          ),
        ),
      ),
      ),
    );
  }
}
