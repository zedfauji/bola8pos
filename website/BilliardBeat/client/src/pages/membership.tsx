import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { insertMemberSchema, type InsertMember } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Crown, CheckCircle } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

const membershipBenefits = [
  {
    icon: "fas fa-percentage",
    title: "Descuentos Especiales",
    description: "15% de descuento en todas las consumiciones"
  },
  {
    icon: "fas fa-calendar-alt",
    title: "Reservaciones Prioritarias", 
    description: "Garantiza tu mesa favorita"
  },
  {
    icon: "fas fa-users",
    title: "Eventos Exclusivos",
    description: "Acceso a torneos privados y noches especiales"
  },
  {
    icon: "fas fa-clock",
    title: "Happy Hour Extendido",
    description: "Precios especiales todo el día para miembros"
  },
  {
    icon: "fas fa-birthday-cake",
    title: "Cumpleaños Gratis",
    description: "Mesa gratis el día de tu cumpleaños"
  }
];

export default function Membership() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertMember & { acceptTerms: boolean }>({
    resolver: zodResolver(insertMemberSchema.extend({ 
      acceptTerms: insertMemberSchema.shape.firstName.optional() 
    })),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      birthDate: "",
      acceptTerms: false
    }
  });

  const createMemberMutation = useMutation({
    mutationFn: (data: InsertMember) => apiRequest("POST", "/createMemberwebsite", data),
    onSuccess: () => {
      toast({
        title: "¡Bienvenido al Club!",
        description: "Tu membresía ha sido registrada exitosamente. Te contactaremos pronto con los detalles.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
    },
    onError: () => {
      toast({
        title: "Error en el registro",
        description: "No se pudo procesar tu membresía. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertMember & { acceptTerms: boolean }) => {
    if (!data.acceptTerms) {
      toast({
        title: "Términos y Condiciones",
        description: "Debes aceptar los términos y condiciones para continuar.",
        variant: "destructive",
      });
      return;
    }
    
    const { acceptTerms, ...memberData } = data;
    createMemberMutation.mutate(memberData);
  };

  return (
    <div className="min-h-screen bg-rock-black text-chrome">
      <Navbar />
      
      <div className="pt-20 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="font-rock text-4xl md:text-5xl text-rock-gold mb-4">
              MEMBRESÍA BOLA 8
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Únete al club y obtén beneficios exclusivos
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Benefits */}
            <Card className="bg-charcoal border-chrome/20">
              <CardHeader>
                <CardTitle className="text-chrome font-elegant text-2xl">
                  Beneficios de Membresía
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {membershipBenefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <CheckCircle className="h-6 w-6 text-neon-red mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="text-chrome font-semibold">{benefit.title}</h4>
                      <p className="text-gray-400">{benefit.description}</p>
                    </div>
                  </div>
                ))}

                <div className="mt-8 p-6 bg-rock-black rounded-lg border border-chrome/20">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-rock-gold mb-2">$500</div>
                    <div className="text-chrome">Membresía Anual</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Membership Form */}
            <Card className="bg-charcoal border-chrome/20">
              <CardHeader>
                <CardTitle className="text-chrome font-elegant text-2xl">
                  Regístrate Ahora
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-chrome font-semibold">Nombre</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Tu nombre"
                                className="bg-rock-black border-chrome/30 text-white placeholder-gray-500 focus:border-neon-red"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-chrome font-semibold">Apellido</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Tu apellido"
                                className="bg-rock-black border-chrome/30 text-white placeholder-gray-500 focus:border-neon-red"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-chrome font-semibold">Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="tu@email.com"
                              className="bg-rock-black border-chrome/30 text-white placeholder-gray-500 focus:border-neon-red"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-chrome font-semibold">Teléfono</FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              placeholder="Tu número de teléfono"
                              className="bg-rock-black border-chrome/30 text-white placeholder-gray-500 focus:border-neon-red"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="birthDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-chrome font-semibold">Fecha de Nacimiento</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              className="bg-rock-black border-chrome/30 text-white focus:border-neon-red"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="acceptTerms"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="data-[state=checked]:bg-neon-red data-[state=checked]:border-neon-red"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm text-gray-300">
                              Acepto los términos y condiciones de la membresía
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <Button
                      type="submit"
                      disabled={createMemberMutation.isPending}
                      className="w-full bg-rock-gold hover:bg-yellow-500 text-rock-black font-semibold py-4 px-6 rounded-lg transform hover:scale-105 transition-all duration-200 glow-gold"
                    >
                      <Crown className="mr-2 h-5 w-5" />
                      {createMemberMutation.isPending ? "Procesando..." : "Unirse al Club"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
