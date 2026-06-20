import 'package:flutter/material.dart';
import 'home_screen.dart';
import 'search_screen.dart';
import 'community_screen.dart';
import 'dashboard_screen.dart';
import 'settings_screen.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _selectedIndex = 0;
  late final List<Widget> _widgetOptions;

  @override
  void initState() {
    super.initState();
    _widgetOptions = <Widget>[
      HomeScreen(onNavigate: (index) => setState(() => _selectedIndex = index)),
      const SearchScreen(),
      const CommunityScreen(),
      const DashboardScreen(),
      const SettingsScreen(),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // O IndexedStack mantém todas as telas vivas na memória, 
      // assim você não perde o scroll nem precisa recarregar a API ao trocar de aba!
      body: IndexedStack(
        index: _selectedIndex,
        children: _widgetOptions,
      ),
      bottomNavigationBar: BottomNavigationBar(
        backgroundColor: const Color(0xFF141414), // Fundo escuro do app
        selectedItemColor: const Color(0xFF007bff), // Azul Primário
        unselectedItemColor: Colors.grey,
        currentIndex: _selectedIndex,
        type: BottomNavigationBarType.fixed,
        onTap: (index) {
          setState(() {
            _selectedIndex = index;
          });
        },
        // Fixa a cor de fundo e previne a animação "shifting" padrão que esconde rótulos
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.event_note), label: 'Agenda'),
          BottomNavigationBarItem(icon: Icon(Icons.search), label: 'Buscar'),
          BottomNavigationBarItem(icon: Icon(Icons.people), label: 'Comunidade'),
          BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: 'Dashboard'),
          BottomNavigationBarItem(icon: Icon(Icons.settings), label: 'Config'),
        ],
      ),
    );
  }
}