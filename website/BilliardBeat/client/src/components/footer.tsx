import { Link } from "wouter";
import Logo from "@/components/logo";

export default function Footer() {
  return (
    <footer className="bg-charcoal border-t border-chrome/20 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Logo size="md" />
          </div>
          
          <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
            Un grupo de entusiastas del billar trayendo ideas frescas para mejorar tu experiencia. 
            Rock, billar y las mejores cervezas artesanales.
          </p>
          
          <div className="flex flex-wrap justify-center gap-6 mb-6">
            <Link href="/" className="text-chrome hover:text-neon-red transition-colors">Inicio</Link>
            <Link href="/reservations" className="text-chrome hover:text-neon-red transition-colors">Reservaciones</Link>
            <Link href="/menu" className="text-chrome hover:text-neon-red transition-colors">Menú</Link>
            <Link href="/membership" className="text-chrome hover:text-neon-red transition-colors">Membresía</Link>
            <Link href="/promotions" className="text-chrome hover:text-neon-red transition-colors">Promociones</Link>
          </div>
          
          <div className="flex justify-center space-x-4 mb-6">
            <a href="https://www.facebook.com/bola.8gdl" target="_blank" rel="noopener noreferrer" className="text-chrome hover:text-neon-red transition-colors">
              <i className="fab fa-facebook-f text-xl"></i>
            </a>
            <a href="https://www.instagram.com/bola8billarclub/" target="_blank" rel="noopener noreferrer" className="text-chrome hover:text-neon-red transition-colors">
              <i className="fab fa-instagram text-xl"></i>
            </a>
          </div>
          
          <div className="border-t border-chrome/20 pt-6">
            <p className="text-gray-500">© 2024 Bola 8 Pool Club La Calma. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
