import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

interface MenuItem {
  name: string;
  price: number | string;
  description?: string;
  options?: { name: string; price: number }[];
  image?: string;
}

interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

const menuData: MenuCategory[] = [
  {
    id: "entradas",
    name: "Entradas",
    items: [
      {
        name: "Alitas (700G)",
        price: 179,
        description: "Alitas con salsa a eligir: Buffalo, BBQ, Hot BBQ, Smokey BBQ, Mango Habanero, Tamarindo Habanero, Lemon Pepper, Parmesano",
        image: "https://images.unsplash.com/photo-1544928147-79a2dbc1f389?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
      },
      {
        name: "Alitas (350G)",
        price: 90,
        description: "Porción media con tu salsa favorita",
        image: "https://images.unsplash.com/photo-1608039755401-742074f0548a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
      },
      {
        name: "Boneless (300G)",
        price: 169,
        description: "Trozos de pollo sin hueso bañados en salsa",
        image: "https://images.unsplash.com/photo-1562967914-608f82629710?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
      },
      {
        name: "Tenders (300G)",
        price: 169,
        description: "Dedos de pollo empanizados crujientes",
        image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
      }
    ]
  },
  {
    id: "botanas",
    name: "Botanas",
    items: [
      {
        name: "Papas Doradas Preparadas (300gm)",
        price: 55,
        description: "Papas con preparado especial",
        image: "https://images.unsplash.com/photo-1518013431117-eb1465fa5752?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
      },
      {
        name: "Papas a la Francesa (300gm)",
        price: "75/100",
        description: "Sin Queso $75 / Con Queso $100",
        image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
      },
      {
        name: "Papas Gajo",
        price: "75/100", 
        description: "Sin Queso $75 / Con Queso $100",
        image: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
      },
      {
        name: "Salchipulpos (250gm)",
        price: 80,
        description: "Salchichas en forma de pulpo",
        image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
      },
      {
        name: "Salchicha Botanera (500gm)",
        price: 85,
        image: "https://images.unsplash.com/photo-1550317138-10000687ac99?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
      },
      {
        name: "Tiras de Camote a la francesa (300gm)",
        price: 75,
        image: "https://images.unsplash.com/photo-1576020799627-aeac74d58064?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
      },
      {
        name: "Aros de Cebolla (150gm)",
        price: 75,
        image: "https://images.unsplash.com/photo-1639024471283-03518883512d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
      },
      {
        name: "Dedos de Queso (6 pzs)",
        price: 109,
        description: "Queso mozzarella empanizado",
        image: "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
      },
      {
        name: "Carne Seca (50gm)",
        price: 80,
        description: "Carne deshidratada tradicional",
        image: "https://images.unsplash.com/photo-1529042410759-befb1204b468?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"
      }
    ]
  },
  {
    id: "cervezas",
    name: "Cervezas",
    items: [
      { name: "Indio", price: 35, image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Tecate", price: 35, image: "https://images.unsplash.com/photo-1608270586620-248524c67de9?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Tecate Light", price: 35, image: "https://images.unsplash.com/photo-1574006344512-8c5a5e0e7d6a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Dos Equis Lager", price: 35, image: "https://images.unsplash.com/photo-1585159812596-ed875621ea5e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Dos Equis Ambar", price: 35, image: "https://images.unsplash.com/photo-1571919743851-c8c2b3c76943?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Amstel Ultra", price: 35, image: "https://images.unsplash.com/photo-1603027354804-1b4c92ad1c52?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Pacifico", price: 40, image: "https://images.unsplash.com/photo-1553975176-4076ad6ec13a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Corona", price: 40, image: "https://images.unsplash.com/photo-1615329812974-9b37ef1c2e8a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Victoria", price: 40, image: "https://images.unsplash.com/photo-1600298881974-6be191ceeda1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Heineken", price: 40, image: "https://images.unsplash.com/photo-1571068316344-75bc76f77890?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Heineken 0.0", price: 40, image: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Bohemia Clara", price: 40, image: "https://images.unsplash.com/photo-1566843797784-fb95c0a1aa2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Bohemia Obscura", price: 40, image: "https://images.unsplash.com/photo-1566843875379-58bd1c2cdfb3?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Bohemia Cristal", price: 40, image: "https://images.unsplash.com/photo-1553975175-ca63b8cfa44c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Bohemia Weizen", price: 40, image: "https://images.unsplash.com/photo-1574006344512-8c5a5e0e7d6a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" }
    ]
  },
  {
    id: "artesanales",
    name: "Cervezas Artesanales",
    items: [
      { name: "Jabalí Helles", price: 60, description: "Cerveza artesanal estilo alemán", image: "https://images.unsplash.com/photo-1566843797784-fb95c0a1aa2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Jabalí Bock", price: 60, image: "https://images.unsplash.com/photo-1574006344512-8c5a5e0e7d6a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Jabalí Salvajitas", price: 60, image: "https://images.unsplash.com/photo-1608270586620-248524c67de9?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Tempus Dorada", price: 60, image: "https://images.unsplash.com/photo-1553975176-4076ad6ec13a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Tempus Malta", price: 90, description: "Cerveza de malta premium", image: "https://images.unsplash.com/photo-1566843875379-58bd1c2cdfb3?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Fortuna Cañita Lager", price: 75, image: "https://images.unsplash.com/photo-1615329812974-9b37ef1c2e8a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Fortuna California Ale", price: 75, image: "https://images.unsplash.com/photo-1571068316344-75bc76f77890?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Fortuna Ippolita", price: 75, description: "India Pale Ale con sabor intenso", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Fortuna Out Stout", price: 75, image: "https://images.unsplash.com/photo-1600298881974-6be191ceeda1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Fortuna Neippolita", price: 75, image: "https://images.unsplash.com/photo-1585159812596-ed875621ea5e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Kumo IPA", price: 90, image: "https://images.unsplash.com/photo-1603027354804-1b4c92ad1c52?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" },
      { name: "Kumo Stout", price: 90, description: "Cerveza negra de sabor robusto", image: "https://images.unsplash.com/photo-1571919743851-c8c2b3c76943?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300" }
    ]
  },
  {
    id: "bebidas",
    name: "Bebidas",
    items: [
      {
        name: "Michelada Rusa",
        price: 75,
        description: "Cerveza, Sal y Limón"
      },
      {
        name: "Michelada Tradicional",
        price: 75,
        description: "Cerveza, Sal, Limón, Salsa Negra y Tajín"
      },
      {
        name: "Michelada con Clamato",
        price: 75,
        description: "Cerveza, Sal, Limón, Clamato y Tajín"
      },
      { name: "Coca Cola", price: 29 },
      { name: "Refrescos Varios", price: 29 },
      { name: "New Mix", price: 40 },
      { name: "Limonada Peñafiel", price: 35 },
      { name: "Naranjada Peñafiel", price: 35 }
    ]
  },
  {
    id: "cubetas",
    name: "Cubetas",
    items: [
      {
        name: "Cubeta Regular (10 Cervezas)",
        price: 300,
        description: "Indio, Tecate, Tecate Light, Dos Equis Lager, Dos Equis Ámbar"
      },
      {
        name: "Cubeta Premium (10 Cervezas)",
        price: 380,
        description: "Corona, Victoria, Pacífico, Heineken, Bohemia"
      }
    ]
  }
];

export default function Menu() {
  const [activeCategory, setActiveCategory] = useState("entradas");

  const activeItems = menuData.find(category => category.id === activeCategory)?.items || [];

  return (
    <div className="min-h-screen bg-rock-black text-chrome">
      <Navbar />
      
      <div className="pt-20 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="font-rock text-4xl md:text-5xl text-rock-gold mb-4">
              NUESTRO MENÚ
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Comida deliciosa y las mejores cervezas para acompañar tu juego
            </p>
          </div>

          {/* Menu Categories Tabs */}
          <div className="flex flex-wrap justify-center mb-8 gap-2">
            {menuData.map((category) => (
              <Button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-6 py-3 rounded-lg font-semibold ${
                  activeCategory === category.id 
                    ? "bg-neon-red text-white" 
                    : "bg-rock-black text-chrome hover:bg-charcoal"
                }`}
              >
                {category.name}
              </Button>
            ))}
          </div>

          {/* Menu Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeItems.map((item, index) => (
              <Card key={index} className="bg-rock-black border-chrome/20 hover:border-neon-red transition-all duration-300 overflow-hidden group">
                {item.image && (
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-rock-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-4 right-4">
                      <span className="bg-neon-red text-white font-bold text-lg px-3 py-1 rounded-lg shadow-lg">
                        ${item.price}
                      </span>
                    </div>
                  </div>
                )}
                <CardContent className="p-6">
                  <CardTitle className="text-chrome text-lg font-semibold mb-3">
                    {item.name}
                  </CardTitle>
                  {!item.image && (
                    <div className="flex justify-end mb-3">
                      <span className="text-neon-red font-bold text-xl">
                        ${item.price}
                      </span>
                    </div>
                  )}
                  {item.description && (
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
