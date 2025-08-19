import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Clock, MapPin, Play } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

interface SportGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "LIVE" | "UPCOMING" | "FINISHED";
  venue: string;
  time: string;
}

export default function Sports() {
  const { data: mexicanGames, isLoading: isLoadingMexican } = useQuery<SportGame[]>({
    queryKey: ["/api/sports/mexican-football"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: nflGames, isLoading: isLoadingNFL } = useQuery<SportGame[]>({
    queryKey: ["/api/sports/nfl"],
    refetchInterval: 30000,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "LIVE":
        return "bg-green-600 text-white";
      case "UPCOMING":
        return "bg-blue-600 text-white";
      case "FINISHED":
        return "bg-gray-600 text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "LIVE":
        return "EN VIVO";
      case "UPCOMING":
        return "PRÓXIMO";
      case "FINISHED":
        return "TERMINADO";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-rock-black text-chrome">
      <Navbar />
      
      <div className="pt-20 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="relative">
              <h1 className="font-rock text-4xl md:text-6xl text-rock-gold mb-4 tracking-wider">
                DEPORTES EN VIVO
              </h1>
              <div className="absolute -top-2 -left-2 w-8 h-8 bg-neon-red rounded-full animate-pulse"></div>
              <div className="absolute -top-1 -right-4 w-4 h-4 bg-rock-gold rounded-full animate-pulse delay-500"></div>
            </div>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">
              No te pierdas ningún juego mientras disfrutas del mejor billar y rock
            </p>
            <div className="flex justify-center items-center space-x-4 text-sm text-gray-400">
              <Clock className="h-4 w-4" />
              <span>Actualizado cada 30 segundos</span>
            </div>
          </div>

          {/* Featured Live Games Banner */}
          <div className="mb-12">
            <div className="bg-gradient-to-r from-neon-red to-red-700 p-6 rounded-xl shadow-2xl border border-red-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Play className="h-8 w-8 text-white animate-pulse" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xl">EN VIVO AHORA</h3>
                    <p className="text-red-100">Juegos que puedes ver mientras juegas</p>
                  </div>
                </div>
                <Trophy className="h-12 w-12 text-yellow-300" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Liga MX Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                    <i className="fas fa-futbol text-white text-xl"></i>
                  </div>
                  <div>
                    <h2 className="font-rock text-2xl text-chrome">LIGA MX</h2>
                    <p className="text-gray-400 text-sm">Fútbol Mexicano</p>
                  </div>
                </div>
                <div className="bg-green-600/20 px-3 py-1 rounded-full border border-green-600/30">
                  <span className="text-green-400 text-sm font-semibold">MÉXICO</span>
                </div>
              </div>

              <div className="relative">
                <div 
                  className="absolute inset-0 bg-cover bg-center rounded-lg opacity-20"
                  style={{
                    backgroundImage: "url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400')"
                  }}
                ></div>
                <Card className="bg-charcoal/90 border-green-600/20 backdrop-blur-sm relative">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {isLoadingMexican ? (
                        <div className="space-y-4">
                          <Skeleton className="h-24 bg-rock-black/50 rounded-xl" />
                          <Skeleton className="h-24 bg-rock-black/50 rounded-xl" />
                        </div>
                      ) : mexicanGames && mexicanGames.length > 0 ? (
                        mexicanGames.map((game) => (
                          <div key={game.id} className="bg-gradient-to-r from-rock-black/80 to-charcoal/80 p-6 rounded-xl border border-green-600/20 hover:border-green-600/40 transition-all duration-300 transform hover:scale-[1.02]">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center space-x-6">
                                <div className="text-center">
                                  <div className="text-chrome font-bold text-lg">{game.homeTeam}</div>
                                  <div className="text-gray-400 text-xs">LOCAL</div>
                                </div>
                                <div className="flex flex-col items-center">
                                  <div className="text-2xl font-bold text-neon-red mb-1">
                                    {game.homeScore !== null && game.awayScore !== null 
                                      ? `${game.homeScore} - ${game.awayScore}` 
                                      : game.time
                                    }
                                  </div>
                                  <Badge className={`${getStatusColor(game.status)} text-xs px-3 py-1`}>
                                    {getStatusText(game.status)}
                                  </Badge>
                                </div>
                                <div className="text-center">
                                  <div className="text-chrome font-bold text-lg">{game.awayTeam}</div>
                                  <div className="text-gray-400 text-xs">VISITANTE</div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center text-sm text-gray-400 pt-3 border-t border-gray-600/30">
                              <MapPin className="h-4 w-4 mr-2" />
                              {game.venue} {game.status === "LIVE" && `• ${game.time}`}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-400 py-12 bg-rock-black/50 rounded-xl border border-gray-600/20">
                          <Trophy className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                          <p>No hay juegos disponibles en este momento</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* NFL Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center">
                    <i className="fas fa-football-ball text-white text-xl"></i>
                  </div>
                  <div>
                    <h2 className="font-rock text-2xl text-chrome">NFL</h2>
                    <p className="text-gray-400 text-sm">Fútbol Americano</p>
                  </div>
                </div>
                <div className="bg-orange-600/20 px-3 py-1 rounded-full border border-orange-600/30">
                  <span className="text-orange-400 text-sm font-semibold">USA</span>
                </div>
              </div>

              <div className="relative">
                <div 
                  className="absolute inset-0 bg-cover bg-center rounded-lg opacity-20"
                  style={{
                    backgroundImage: "url('https://images.unsplash.com/photo-1508729742900-849b7745c9ac?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400')"
                  }}
                ></div>
                <Card className="bg-charcoal/90 border-orange-600/20 backdrop-blur-sm relative">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {isLoadingNFL ? (
                        <div className="space-y-4">
                          <Skeleton className="h-24 bg-rock-black/50 rounded-xl" />
                          <Skeleton className="h-24 bg-rock-black/50 rounded-xl" />
                        </div>
                      ) : nflGames && nflGames.length > 0 ? (
                        nflGames.map((game) => (
                          <div key={game.id} className="bg-gradient-to-r from-rock-black/80 to-charcoal/80 p-6 rounded-xl border border-orange-600/20 hover:border-orange-600/40 transition-all duration-300 transform hover:scale-[1.02]">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center space-x-6">
                                <div className="text-center">
                                  <div className="text-chrome font-bold text-lg">{game.homeTeam}</div>
                                  <div className="text-gray-400 text-xs">HOME</div>
                                </div>
                                <div className="flex flex-col items-center">
                                  <div className="text-2xl font-bold text-neon-red mb-1">
                                    {game.homeScore !== null && game.awayScore !== null 
                                      ? `${game.homeScore} - ${game.awayScore}` 
                                      : game.time
                                    }
                                  </div>
                                  <Badge className={`${getStatusColor(game.status)} text-xs px-3 py-1`}>
                                    {getStatusText(game.status)}
                                  </Badge>
                                </div>
                                <div className="text-center">
                                  <div className="text-chrome font-bold text-lg">{game.awayTeam}</div>
                                  <div className="text-gray-400 text-xs">AWAY</div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center text-sm text-gray-400 pt-3 border-t border-gray-600/30">
                              <MapPin className="h-4 w-4 mr-2" />
                              {game.venue} {game.status === "LIVE" && `• ${game.time}`}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-400 py-12 bg-rock-black/50 rounded-xl border border-gray-600/20">
                          <Trophy className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                          <p>No hay juegos disponibles en este momento</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="mt-16 text-center">
            <Card className="bg-gradient-to-r from-neon-red/10 to-rock-gold/10 border-neon-red/30">
              <CardContent className="p-8">
                <h3 className="font-rock text-2xl text-rock-gold mb-4">
                  ¡NO TE PIERDAS LA ACCIÓN!
                </h3>
                <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                  Reserva tu mesa ahora y disfruta de los mejores juegos mientras juegas billar con tus amigos
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button className="bg-neon-red hover:bg-red-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors">
                    Reservar Mesa Ahora
                  </button>
                  <button className="border border-rock-gold text-rock-gold hover:bg-rock-gold hover:text-rock-black font-semibold py-3 px-8 rounded-lg transition-colors">
                    Ver Menú Completo
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
