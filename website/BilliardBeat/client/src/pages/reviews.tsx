import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { insertReviewSchema, type InsertReview, type Review } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Star, Send } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export default function Reviews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRating, setSelectedRating] = useState(0);

  const { data: reviews, isLoading } = useQuery<Review[]>({
    queryKey: ["/api/reviews"],
  });

  const form = useForm<InsertReview>({
    resolver: zodResolver(insertReviewSchema),
    defaultValues: {
      name: "",
      rating: 0,
      comment: ""
    }
  });

  const createReviewMutation = useMutation({
    mutationFn: (data: InsertReview) => apiRequest("POST", "/api/reviews", data),
    onSuccess: () => {
      toast({
        title: "¡Reseña Enviada!",
        description: "Gracias por compartir tu experiencia con nosotros.",
      });
      form.reset();
      setSelectedRating(0);
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
    },
    onError: () => {
      toast({
        title: "Error al enviar reseña",
        description: "No se pudo enviar tu reseña. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertReview) => {
    createReviewMutation.mutate({ ...data, rating: selectedRating });
  };

  const averageRating = reviews && reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return "";
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return "Hoy";
    if (diffInDays === 1) return "Ayer";
    if (diffInDays < 7) return `Hace ${diffInDays} días`;
    if (diffInDays < 30) return `Hace ${Math.floor(diffInDays / 7)} semanas`;
    return `Hace ${Math.floor(diffInDays / 30)} meses`;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-rock-black text-chrome">
      <Navbar />
      
      <div className="pt-20 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="font-rock text-4xl md:text-5xl text-rock-gold mb-4">
              RESEÑAS
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Lo que dicen nuestros clientes sobre la experiencia
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Reviews Display */}
            <div className="space-y-6">
              {/* Overall Rating */}
              <Card className="bg-rock-black border-chrome/20 text-center">
                <CardContent className="p-6">
                  <div className="text-4xl text-rock-gold font-bold mb-2">
                    {averageRating.toFixed(1)}
                  </div>
                  <div className="flex justify-center mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-6 w-6 ${
                          star <= Math.round(averageRating)
                            ? "text-yellow-400 fill-current"
                            : "text-gray-400"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-chrome">
                    Basado en {reviews?.length || 0} reseñas
                  </p>
                </CardContent>
              </Card>

              {/* Reviews List */}
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="bg-rock-black border-chrome/20">
                      <CardContent className="p-6">
                        <div className="flex items-center mb-4">
                          <Skeleton className="w-12 h-12 rounded-full bg-charcoal mr-4" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-32 bg-charcoal mb-2" />
                            <Skeleton className="h-4 w-20 bg-charcoal" />
                          </div>
                        </div>
                        <Skeleton className="h-16 w-full bg-charcoal" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : reviews && reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <Card key={review.id} className="bg-rock-black border-chrome/20">
                      <CardContent className="p-6">
                        <div className="flex items-center mb-4">
                          <div className="w-12 h-12 bg-chrome rounded-full flex items-center justify-center text-rock-black font-bold mr-4">
                            {getInitials(review.name)}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-chrome font-semibold">{review.name}</h4>
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-4 w-4 ${
                                    star <= review.rating
                                      ? "text-yellow-400 fill-current"
                                      : "text-gray-400"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-300 mb-2">{review.comment}</p>
                        <div className="text-sm text-gray-500">
                          {formatTimeAgo(review.createdAt)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-rock-black border-chrome/20">
                  <CardContent className="p-6 text-center text-gray-400">
                    <p>Aún no hay reseñas. ¡Sé el primero en compartir tu experiencia!</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Leave Review Form */}
            <Card className="bg-rock-black border-chrome/20 h-fit">
              <CardHeader>
                <CardTitle className="text-chrome font-elegant text-2xl">
                  Deja tu Reseña
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-chrome font-semibold">Nombre</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Tu nombre"
                              className="bg-charcoal border-chrome/30 text-white placeholder-gray-500 focus:border-neon-red"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div>
                      <FormLabel className="text-chrome font-semibold">Calificación</FormLabel>
                      <div className="flex space-x-1 mt-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setSelectedRating(star)}
                            className="focus:outline-none"
                          >
                            <Star
                              className={`h-8 w-8 transition-colors ${
                                star <= selectedRating
                                  ? "text-yellow-400 fill-current"
                                  : "text-gray-400 hover:text-yellow-400"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      {selectedRating === 0 && (
                        <p className="text-sm text-red-400 mt-1">Por favor selecciona una calificación</p>
                      )}
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="comment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-chrome font-semibold">Tu Reseña</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Comparte tu experiencia..."
                              rows={4}
                              className="bg-charcoal border-chrome/30 text-white placeholder-gray-500 focus:border-neon-red resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button
                      type="submit"
                      disabled={createReviewMutation.isPending || selectedRating === 0}
                      className="w-full bg-neon-red hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {createReviewMutation.isPending ? "Enviando..." : "Enviar Reseña"}
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
