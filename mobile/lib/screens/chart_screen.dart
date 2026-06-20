import 'package:flutter/material.dart';

class ChartScreen extends StatelessWidget {
  final Map<String, dynamic> moviesPerMonth;

  const ChartScreen({super.key, required this.moviesPerMonth});

  @override
  Widget build(BuildContext context) {
    // 1. Transformar o mapa em uma lista e ordenar pelas datas (Ex: '2023-10', '2023-11')
    final entries = moviesPerMonth.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    
    // 2. Pegar todos os meses disponíveis para o scroll horizontal
    final recentEntries = entries;

    // 3. Achar o mês com mais filmes para calcular a proporção máxima (100% da altura)
    int maxMovies = 1;
    for (var entry in recentEntries) {
      if ((entry.value as num).toInt() > maxMovies) {
        maxMovies = (entry.value as num).toInt();
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('📈 Filmes por Mês', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF007bff))),
        backgroundColor: const Color(0xFF222222),
      ),
      body: recentEntries.isEmpty 
          ? const Center(child: Text('Nenhum dado disponível', style: TextStyle(color: Colors.grey)))
          : Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                children: [
                  Text(
                    'Histórico de Meses', 
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)
                  ),
                  const SizedBox(height: 40),
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisAlignment: MainAxisAlignment.start,
                        children: recentEntries.map((entry) {
                          final monthStr = entry.key; // Ex: "2024-04"
                          final parts = monthStr.split('-');
                          final label = parts.length == 2 ? '${parts[1]}/${parts[0].substring(2)}' : monthStr;
                          final count = (entry.value as num).toInt();
                          
                          // Fator de altura (de 0.0 até 1.0) comparado ao mês mais cheio
                          final heightFactor = count / maxMovies;
  
                          return SizedBox(
                            width: 65, // Largura fixa para cada barra para ativar o scroll
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                Text('$count', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white)),
                                const SizedBox(height: 8),
                                Flexible(
                                  child: FractionallySizedBox(
                                    heightFactor: heightFactor > 0 ? heightFactor : 0.01,
                                    alignment: Alignment.bottomCenter,
                                    child: Container(margin: const EdgeInsets.symmetric(horizontal: 8), decoration: const BoxDecoration(color: Color(0xFF007bff), borderRadius: BorderRadius.vertical(top: Radius.circular(6)))),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
    );
  }
}