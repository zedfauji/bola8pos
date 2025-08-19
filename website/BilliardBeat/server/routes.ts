import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertReservationSchema, insertMemberSchema, insertReviewSchema, insertContactSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Table Reservations
  app.post("/api/reservations", async (req, res) => {
    try {
      const validatedData = insertReservationSchema.parse(req.body);
      const reservation = await storage.createReservation(validatedData);
      res.json(reservation);
    } catch (error) {
      res.status(400).json({ error: "Invalid reservation data" });
    }
  });

  app.get("/api/reservations", async (req, res) => {
    try {
      const reservations = await storage.getReservations();
      res.json(reservations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reservations" });
    }
  });

  // POS Integration Routes
  app.post("/createReservationWebsite", async (req, res) => {
    try {
      const validatedData = insertReservationSchema.parse(req.body);
      const reservation = await storage.createReservation(validatedData);
      res.json({ success: true, reservation });
    } catch (error) {
      res.status(400).json({ success: false, error: "Invalid reservation data" });
    }
  });

  app.post("/createMemberwebsite", async (req, res) => {
    try {
      const validatedData = insertMemberSchema.parse(req.body);
      const member = await storage.createMember(validatedData);
      res.json({ success: true, member });
    } catch (error) {
      res.status(400).json({ success: false, error: "Invalid member data" });
    }
  });

  // Members
  app.post("/api/members", async (req, res) => {
    try {
      const validatedData = insertMemberSchema.parse(req.body);
      const member = await storage.createMember(validatedData);
      res.json(member);
    } catch (error) {
      res.status(400).json({ error: "Invalid member data" });
    }
  });

  app.get("/api/members", async (req, res) => {
    try {
      const members = await storage.getMembers();
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  // Reviews
  app.post("/api/reviews", async (req, res) => {
    try {
      const validatedData = insertReviewSchema.parse(req.body);
      const review = await storage.createReview(validatedData);
      res.json(review);
    } catch (error) {
      res.status(400).json({ error: "Invalid review data" });
    }
  });

  app.get("/api/reviews", async (req, res) => {
    try {
      const reviews = await storage.getReviews();
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  // Contact
  app.post("/api/contact", async (req, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(validatedData);
      res.json(contact);
    } catch (error) {
      res.status(400).json({ error: "Invalid contact data" });
    }
  });

  // Sports data (mock API endpoint)
  app.get("/api/sports/mexican-football", async (req, res) => {
    try {
      // In a real app, this would call external sports API
      const mockGames = [
        {
          id: "1",
          homeTeam: "América",
          awayTeam: "Guadalajara",
          homeScore: 2,
          awayScore: 1,
          status: "LIVE",
          venue: "Estadio Azteca",
          time: "75'"
        },
        {
          id: "2", 
          homeTeam: "Tigres",
          awayTeam: "Monterrey",
          homeScore: null,
          awayScore: null,
          status: "UPCOMING",
          venue: "Estadio Universitario",
          time: "20:00"
        }
      ];
      res.json(mockGames);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sports data" });
    }
  });

  app.get("/api/sports/nfl", async (req, res) => {
    try {
      // In a real app, this would call external sports API
      const mockGames = [
        {
          id: "1",
          homeTeam: "Cowboys",
          awayTeam: "Giants", 
          homeScore: 21,
          awayScore: 14,
          status: "LIVE",
          venue: "AT&T Stadium",
          time: "Q3 - 8:45"
        },
        {
          id: "2",
          homeTeam: "Chiefs", 
          awayTeam: "Bills",
          homeScore: null,
          awayScore: null,
          status: "UPCOMING",
          venue: "Arrowhead Stadium",
          time: "22:00"
        }
      ];
      res.json(mockGames);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch NFL data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
