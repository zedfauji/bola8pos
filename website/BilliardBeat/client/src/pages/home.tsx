import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Calendar, Utensils, ChevronDown, Beer, Percent, Play, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import Logo from "@/components/logo";

export default function Home() {
  const { data: mexicanGames } = useQuery({
    queryKey: ['/api/sports/mexican-football'],
    staleTime: 30 * 1000,
  });

  const { data: nflGames } = useQuery({
    queryKey: ['/api/sports/nfl'], 
    staleTime: 30 * 1000,
  });

  const todayGames = [...(mexicanGames || []), ...(nflGames || [])].slice(0, 2);

  return (
    <div className="min-h-screen bg-rock-black text-chrome">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-rock-black via-charcoal to-rock-black opacity-90"></div>
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080')",
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        ></div>
        
        {/* Background Logo Watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <Logo size="xl" showText={false} className="transform scale-[3]" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="mb-8">
            <Logo size="xl" className="justify-center" />
          </div>
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            Cervezas Artesanales, Alitas, Rock Music, 5 Pool Tables y Great Food.
            <br />Un grupo de entusiastas del billar (ingenieros) trayendo ideas frescas para mejorar tu experiencia.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/reservations">
              <Button className="bg-neon-red hover:bg-red-600 text-white font-semibold py-4 px-8 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 glow-red">
                <Calendar className="mr-2 h-5 w-5" />
                Reservar Mesa
              </Button>
            </Link>
            <Link href="/menu">
              <Button variant="outline" className="border-2 border-chrome text-chrome hover:bg-chrome hover:text-rock-black font-semibold py-4 px-8 rounded-lg transition-all duration-200">
                <Utensils className="mr-2 h-5 w-5" />
                Ver Menú
              </Button>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-chrome animate-bounce">
          <ChevronDown className="h-8 w-8" />
        </div>
      </section>

      {/* Today's Games Section */}
      <section className="py-16 bg-gradient-to-r from-rock-black to-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <Play className="h-8 w-8 text-neon-red animate-pulse mr-3" />
              <h2 className="font-rock text-3xl md:text-4xl text-rock-gold">
                JUEGOS DE HOY
              </h2>
              <Trophy className="h-8 w-8 text-rock-gold ml-3" />
            </div>
            <p className="text-gray-300 text-lg">Disfruta los mejores juegos mientras juegas billar</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {todayGames.length > 0 ? todayGames.map((game, index) => (
              <Card key={index} className="bg-gradient-to-r from-rock-black/90 to-charcoal/90 border border-neon-red/30 hover:border-neon-red/60 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Badge className="bg-neon-red/20 text-neon-red border-neon-red/50">
                      {game.homeTeam.includes('América') || game.homeTeam.includes('Cruz Azul') ? 'LIGA MX' : 'NFL'}
                    </Badge>
                    <div className="flex items-center text-sm text-gray-400">
                      <div className="w-2 h-2 bg-neon-red rounded-full animate-pulse mr-2"></div>
                      EN VIVO
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <div className="text-chrome font-bold text-lg">{game.homeTeam}</div>
                      <div className="text-gray-400 text-xs">LOCAL</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-neon-red">
                        {game.homeScore !== null && game.awayScore !== null 
                          ? `${game.homeScore} - ${game.awayScore}` 
                          : game.time
                        }
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-chrome font-bold text-lg">{game.awayTeam}</div>
                      <div className="text-gray-400 text-xs">VISITANTE</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="col-span-2 text-center py-12">
                <Trophy className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No hay juegos programados para hoy</p>
                <Link href="/sports">
                  <Button className="mt-4 bg-neon-red hover:bg-red-600 text-white">
                    Ver Todos los Deportes
                  </Button>
                </Link>
              </div>
            )}
          </div>
          
          <div className="text-center mt-8">
            <Link href="/sports">
              <Button variant="outline" className="border-2 border-rock-gold text-rock-gold hover:bg-rock-gold hover:text-rock-black">
                Ver Más Deportes
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 bg-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-rock text-4xl md:text-5xl text-rock-gold mb-6">
                ¡ÚNETE A NOSOTROS!
              </h2>
              <p className="text-lg text-gray-300 mb-6 leading-relaxed">
                Todos los días de 3-11 PM
              </p>
              
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="text-center p-4 bg-rock-black/50 rounded-lg border border-chrome/20">
                  <div className="text-2xl font-bold text-neon-red">$35</div>
                  <div className="text-chrome text-sm">Cervezas</div>
                </div>
                <div className="text-center p-4 bg-rock-black/50 rounded-lg border border-chrome/20">
                  <div className="text-2xl font-bold text-neon-red">$75</div>
                  <div className="text-chrome text-sm">Artesanales</div>
                </div>
                <div className="text-center p-4 bg-rock-black/50 rounded-lg border border-chrome/20">
                  <div className="text-2xl font-bold text-neon-red">$75</div>
                  <div className="text-chrome text-sm">Papas</div>
                </div>
              </div>

              <Button className="bg-rock-gold hover:bg-yellow-500 text-rock-black font-semibold py-3 px-8 rounded-lg transform hover:scale-105 transition-all duration-200">
                <Percent className="mr-2 h-5 w-5" />
                Pregunta por Promos
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <img 
                src="https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400" 
                alt="Mesa de billar profesional con bolas" 
                className="rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300"
              />
              <img 
                src="https://images.unsplash.com/photo-1544928147-79a2dbc1f389?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400" 
                alt="Alitas de pollo crujientes con cerveza" 
                className="rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300"
              />
              <img 
                src="https://images.unsplash.com/photo-1608039755401-742074f0548a?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400" 
                alt="Cervezas artesanales y boneless" 
                className="rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300"
              />
              <img 
                src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400" 
                alt="Ambiente rock del billar con luces" 
                className="rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Contact & Location Section */}
      <section className="py-20 bg-rock-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-rock text-4xl md:text-5xl text-rock-gold mb-4">
              VISÍTANOS
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-charcoal p-8 rounded-xl border border-chrome/20">
              <h3 className="font-elegant text-2xl text-chrome mb-6">Información de Contacto</h3>
              
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <i className="fas fa-map-marker-alt text-neon-red text-xl"></i>
                  <div>
                    <h4 className="text-chrome font-semibold">Dirección</h4>
                    <p className="text-gray-300">5061, Av López Mateos Sur, Plaza Orion</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <i className="fas fa-clock text-neon-red text-xl"></i>
                  <div>
                    <h4 className="text-chrome font-semibold">Horarios</h4>
                    <p className="text-gray-300">Lunes a Domingo: 3:00 PM - 11:00 PM</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <i className="fas fa-phone text-neon-red text-xl"></i>
                  <div>
                    <h4 className="text-chrome font-semibold">Teléfono</h4>
                    <p className="text-gray-300">+52 33 1234 5678</p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h4 className="text-chrome font-semibold mb-4">Síguenos</h4>
                <div className="flex space-x-4">
                  <a href="https://www.facebook.com/bola.8gdl" target="_blank" rel="noopener noreferrer" className="bg-rock-black p-3 rounded-lg border border-chrome/20 hover:border-neon-red transition-colors">
                    <i className="fab fa-facebook-f text-chrome hover:text-neon-red transition-colors"></i>
                  </a>
                  <a href="https://www.instagram.com/bola8billarclub/" target="_blank" rel="noopener noreferrer" className="bg-rock-black p-3 rounded-lg border border-chrome/20 hover:border-neon-red transition-colors">
                    <i className="fab fa-instagram text-chrome hover:text-neon-red transition-colors"></i>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
