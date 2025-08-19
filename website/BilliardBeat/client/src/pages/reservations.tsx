import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { insertReservationSchema, type InsertReservation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { CalendarCheck } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

const tables = [
  { id: "any", name: "Cualquier mesa", status: "available", next: "" },
  { id: "1", name: "Mesa 1", status: "available", next: "19:00" },
  { id: "2", name: "Mesa 2", status: "occupied", next: "20:30" },
  { id: "3", name: "Mesa 3", status: "available", next: "18:00" },
  { id: "4", name: "Mesa 4", status: "available", next: "21:00" },
  { id: "5", name: "Mesa 5", status: "occupied", next: "19:30" },
];

const timeSlots = [
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30"
];

const peopleOptions = [
  "2 personas", "4 personas", "6 personas", "8 personas", "10+ personas"
];

export default function Reservations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertReservation>({
    resolver: zodResolver(insertReservationSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      date: "",
      time: "",
      people: 2,
      table: "",
      notes: ""
    }
  });

  const createReservationMutation = useMutation({
    mutationFn: (data: InsertReservation) => apiRequest("POST", "/createReservationWebsite", data),
    onSuccess: () => {
      toast({
        title: "¡Reservación Confirmada!",
        description: "Tu mesa ha sido reservada exitosamente. Te contactaremos pronto.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
    },
    onError: (error) => {
      toast({
        title: "Error en la reservación",
        description: "No se pudo procesar tu reservación. Por favor intenta de nuevo.",
        variant: "destructive",
      });
      console.error("Reservation error:", error);
    },
  });

  const onSubmit = (data: InsertReservation) => {
    // Convert people string to number
    const peopleCount = parseInt(data.people.toString().split(" ")[0]);
    createReservationMutation.mutate({ ...data, people: peopleCount });
  };

  return (
    <div className="min-h-screen bg-rock-black text-chrome">
      <Navbar />
      
      <div className="pt-20 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="font-rock text-4xl md:text-5xl text-rock-gold mb-4">
              RESERVAR MESA
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Asegura tu mesa para una experiencia perfecta. 5 mesas de pool disponibles.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <Card className="bg-charcoal border-chrome/20">
              <CardHeader>
                <CardTitle className="text-chrome font-elegant text-2xl">Nueva Reservación</CardTitle>
                <CardDescription className="text-gray-400">
                  Completa todos los campos para garantizar tu reserva
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-chrome font-semibold">Fecha</FormLabel>
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
                      name="time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-chrome font-semibold">Hora</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-rock-black border-chrome/30 text-white focus:border-neon-red">
                                <SelectValue placeholder="Selecciona una hora" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-charcoal border-chrome/20">
                              {timeSlots.map((time) => (
                                <SelectItem key={time} value={time} className="text-chrome hover:bg-rock-black">
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="people"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-chrome font-semibold">Número de Personas</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger className="bg-rock-black border-chrome/30 text-white focus:border-neon-red">
                                <SelectValue placeholder="¿Cuántas personas?" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-charcoal border-chrome/20">
                              {peopleOptions.map((option) => (
                                <SelectItem key={option} value={option} className="text-chrome hover:bg-rock-black">
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="table"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-chrome font-semibold">Mesa Preferida</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                            <FormControl>
                              <SelectTrigger className="bg-rock-black border-chrome/30 text-white focus:border-neon-red">
                                <SelectValue placeholder="¿Tienes preferencia?" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-charcoal border-chrome/20">
                              {tables.map((table) => (
                                <SelectItem key={table.id} value={table.id} className="text-chrome hover:bg-rock-black">
                                  {table.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="text-chrome font-semibold">Nombre Completo</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Tu nombre completo"
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
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="text-chrome font-semibold">Notas Especiales</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Ocasión especial, preferencias..."
                              rows={3}
                              className="bg-rock-black border-chrome/30 text-white placeholder-gray-500 focus:border-neon-red resize-none"
                              value={field.value || ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="md:col-span-2 text-center">
                      <Button
                        type="submit"
                        disabled={createReservationMutation.isPending}
                        className="bg-neon-red hover:bg-red-600 text-white font-semibold py-4 px-12 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 glow-red"
                      >
                        <CalendarCheck className="mr-2 h-5 w-5" />
                        {createReservationMutation.isPending ? "Procesando..." : "Confirmar Reservación"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Available Tables Display */}
            <div className="mt-12">
              <h3 className="font-elegant text-2xl text-chrome text-center mb-8">Estado de las Mesas</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {tables.slice(1).map((table) => (
                  <Card key={table.id} className="bg-charcoal border-chrome/20 text-center">
                    <CardContent className="p-4">
                      <div className="text-rock-gold font-semibold mb-2">{table.name}</div>
                      <div className={`text-sm mb-1 ${
                        table.status === "available" ? "text-green-400" : "text-red-400"
                      }`}>
                        {table.status === "available" ? "Disponible" : "Ocupada"}
                      </div>
                      {table.next && (
                        <div className="text-gray-400 text-xs">Próxima: {table.next}</div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
