import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Beer, Drum, Trophy } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

const promotions = [
  {
    icon: Beer,
    title: "LUNES LOCOS",
    description: "2x1 en cervezas nacionales después de las 7 PM",
    schedule: "Todos los Lunes",
    color: "border-neon-red"
  },
  {
    icon: Drum,
    title: "VIERNES ROCK",
    description: "Bandas en vivo + 20% descuento en toda la carta",
    schedule: "Viernes 9-11 PM",
    color: "border-neon-red"
  },
  {
    icon: Trophy,
    title: "TORNEO MENSUAL",
    description: "Primer lugar: $2000 + trofeo personalizado",
    schedule: "Último Sábado",
    color: "border-neon-red"
  }
];

const videos = [
  {
    id: "1",
    title: "Mesas de Billar Profesionales",
    description: "5 mesas de pool de alta calidad",
    thumbnail: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400"
  },
  {
    id: "2", 
    title: "Viernes de Rock en Vivo",
    description: "Bandas tocando mientras juegas",
    thumbnail: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400"
  },
  {
    id: "3",
    title: "Alitas y Cervezas Artesanales",
    description: "Los mejores sabores para acompañar tu juego",
    thumbnail: "https://images.unsplash.com/photo-1544928147-79a2dbc1f389?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400"
  }
];

export default function Promotions() {
  const handleVideoPlay = (videoId: string) => {
    // TODO: Implement video player functionality
    console.log(`Playing video ${videoId}`);
  };

  return (
    <div className="min-h-screen bg-rock-black text-chrome">
      <Navbar />
      
      <div className="pt-20 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="font-rock text-4xl md:text-5xl text-rock-gold mb-4">
              PROMOCIONES
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Ofertas especiales y eventos únicos
            </p>
          </div>

          {/* Promotions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {promotions.map((promo, index) => {
              const IconComponent = promo.icon;
              return (
                <Card key={index} className={`bg-rock-black border-2 ${promo.color} hover:scale-105 transition-transform duration-300`}>
                  <CardContent className="p-6">
                    <div className="text-center mb-4">
                      <IconComponent className="h-12 w-12 text-rock-gold mx-auto mb-2" />
                      <CardTitle className="font-rock text-2xl text-chrome">
                        {promo.title}
                      </CardTitle>
                    </div>
                    <p className="text-gray-300 text-center mb-4">
                      {promo.description}
                    </p>
                    <div className="text-center">
                      <Badge className="bg-neon-red text-white text-sm font-semibold">
                        {promo.schedule}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Video Gallery */}
          <div className="mb-12">
            <h2 className="font-elegant text-3xl text-chrome text-center mb-8">
              Videos Promocionales
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <Card key={video.id} className="bg-rock-black border-chrome/20 overflow-hidden hover:border-neon-red transition-colors">
                  <div className="aspect-video relative">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Button
                        onClick={() => handleVideoPlay(video.id)}
                        size="icon"
                        className="bg-neon-red hover:bg-red-600 rounded-full p-4 transform hover:scale-110 transition-all"
                      >
                        <Play className="h-6 w-6 text-white fill-current" />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <CardTitle className="text-chrome font-semibold mb-2">
                      {video.title}
                    </CardTitle>
                    <p className="text-gray-400 text-sm">
                      {video.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Special Events Section */}
          <Card className="bg-gradient-to-r from-charcoal to-rock-black border-rock-gold/50">
            <CardHeader className="text-center">
              <CardTitle className="font-rock text-3xl text-rock-gold mb-4">
                PRÓXIMOS EVENTOS ESPECIALES
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-rock-black/50 p-6 rounded-lg border border-chrome/20">
                  <h3 className="text-chrome font-semibold text-xl mb-2">
                    Torneo de Inauguración
                  </h3>
                  <p className="text-gray-300 mb-4">
                    Celebra con nosotros nuestro gran opening con un torneo especial
                  </p>
                  <Badge className="bg-rock-gold text-rock-black">
                    Próximamente
                  </Badge>
                </div>
                
                <div className="bg-rock-black/50 p-6 rounded-lg border border-chrome/20">
                  <h3 className="text-chrome font-semibold text-xl mb-2">
                    Noche de Karaoke Rock
                  </h3>
                  <p className="text-gray-300 mb-4">
                    Canta tus clásicos del rock favoritos mientras juegas
                  </p>
                  <Badge className="bg-rock-gold text-rock-black">
                    En desarrollo
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
}
