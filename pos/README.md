# Bola8 Billiards POS System

A modern, elegant Point of Sale system for billiard parlors with bar and restaurant operations. Built with React, Node.js, Express, and SQLite for local testing and development.

## 🎱 Features

### Tables Management
- **5 Billiard Tables** with timer functionality ($15/hour)
- **10 Bar Tables** with 4-6 person capacity
- Real-time status tracking (Available, Occupied, Paused)
- Table migration between same types
- Automatic billing calculation

### Order Management
- **10 Beer varieties** (Corona, Budweiser, Heineken, etc.) - $5-$7.50
- **10 Food items** (Wings, Nachos, Fries, etc.) - $8.99-$15.99
- **5 Cocktails** with customization options - $10.99-$13.99
- **Combo deals** (1hr Billiard + 10 Corona + Fries = $50)
- Real-time kitchen integration

### Payment Processing
- Pre-bill generation for customer review
- Multiple payment methods (Cash, Card, Split)
- Automatic tip calculation (15%, 18%, 20%, 25%)
- Bill splitting functionality
- Receipt printing

### Kitchen Display System (KDS)
- Real-time order management
- Status tracking (Pending, In Progress, Completed)
- Priority handling and timing
- Customization display
- Performance analytics

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/zedfauji/bola8pos.git
   cd bola8pos/pos
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Create Database Directory**
   ```bash
   cd ../backend
   mkdir database
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   npm run dev
   ```
   Server will run on `http://localhost:3001`

2. **Start the Frontend (in a new terminal)**
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend will run on `http://localhost:5173`

3. **Open your browser** and navigate to `http://localhost:5173`

## 📱 UI Preview & Navigation

### Dashboard
- Quick stats overview (Active Tables, Pending Orders, Revenue, Kitchen Queue)
- Quick action buttons for all major functions
- Recent activity feed

### Tables Page
- **Billiard Section**: 5 tables with timers, rates, and controls
- **Bar Section**: 10 tables with capacity indicators
- **Actions**: Start/Stop/Pause timers, Move tables, Access orders
- **Real-time updates**: Timer display, billing calculation

### Orders Page
- **Category tabs**: Beers, Food, Cocktails, Combos
- **Menu grid**: Visual item cards with prices and descriptions
- **Shopping cart**: Real-time order summary with quantities
- **Customization**: Cocktail modifications (extra shot, premium spirits, etc.)

### Payment Flow
- **Pre-bill generation**: Detailed breakdown for customer review
- **Payment processing**: Multiple methods, tip calculation, split billing
- **Receipt printing**: Professional formatted receipts
- **Combo discounts**: Automatic 1-hour billiard time deduction

### Kitchen Display
- **Order cards**: Table info, items, customizations, timing
- **Status management**: Pending → In Progress → Completed
- **Priority handling**: Visual indicators for urgent orders
- **Performance metrics**: Average prep time, completion stats

## 🛠 Technical Architecture

### Backend (Node.js + Express + SQLite)
```
backend/
├── src/
│   └── server.js          # Main server file
├── database/
│   └── pos.db            # SQLite database (auto-created)
└── package.json          # Dependencies
```

### Frontend (React + Vite + Tailwind CSS)
```
frontend/
├── src/
│   ├── components/
│   │   ├── TablesPage.jsx     # Table management
│   │   ├── OrderPage.jsx      # Order entry
│   │   ├── PaymentPage.jsx    # Payment processing
│   │   └── KitchenDisplay.jsx # Kitchen display
│   ├── services/
│   │   └── api.js            # API service layer
│   ├── App.jsx               # Main app with routing
│   └── main.tsx              # Entry point
└── package.json              # Dependencies
```

### Database Schema
- **tables**: Table information and status
- **menu_items**: Food, drinks, and combo items
- **orders**: Customer orders with timing
- **order_items**: Individual items in orders
- **bills**: Payment records and history

## 🎨 UI Design Features

### Modern Design System
- **Dark sidebar** with blue accent colors
- **Card-based layouts** with subtle shadows
- **Touch-friendly buttons** (minimum 44px)
- **Responsive grid system** for all screen sizes

### Color Coding
- **Green**: Available tables, completed orders
- **Red**: Occupied tables, overdue orders
- **Yellow**: Paused tables, pending orders
- **Blue**: System actions, primary buttons
- **Purple**: Special features, cocktails

### Interactive Elements
- **Real-time timers** with HH:MM:SS format
- **Status indicators** with color-coded badges
- **Progress tracking** for kitchen orders
- **Hover effects** and smooth transitions

## 📊 Sample Data

The system comes pre-loaded with:
- 15 tables (5 billiard + 10 bar)
- 26 menu items across 4 categories
- Sample orders for testing KDS functionality

## 🔧 Customization

### Adding Menu Items
Edit the `menuItems` array in `backend/src/server.js`:
```javascript
['item_id', 'Item Name', 'category', price, 'description', 'emoji', customizable, prep_time]
```

### Modifying Table Configuration
Update the `tables` array in `backend/src/server.js`:
```javascript
[table_id, 'Table Name', 'type', 'status', capacity, hourly_rate]
```

### Styling Changes
All styles use Tailwind CSS classes. Modify components directly or update `tailwind.config.js` for theme changes.

## 🚀 Production Deployment

### Backend Deployment
1. Set `NODE_ENV=production`
2. Configure proper database path
3. Set up process manager (PM2)
4. Configure reverse proxy (nginx)

### Frontend Deployment
1. Build the frontend: `npm run build`
2. Serve static files from `dist/` folder
3. Configure API endpoint in environment variables

## 🔍 API Endpoints

### Tables
- `GET /api/tables` - Get all tables
- `PUT /api/tables/:id` - Update table status

### Menu
- `GET /api/menu` - Get menu items
- `GET /api/menu?category=beers` - Get items by category

### Orders
- `GET /api/orders` - Get all orders
- `POST /api/orders` - Create new order
- `PUT /api/orders/:id` - Update order status

### Bills
- `POST /api/bills` - Process payment

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Kill process on port 3001
   npx kill-port 3001
   ```

2. **Database connection error**
   ```bash
   # Ensure database directory exists
   mkdir backend/database
   ```

3. **Module not found**
   ```bash
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

## 📈 Future Enhancements

- **Inventory management** with low-stock alerts
- **Employee management** with shift tracking
- **Loyalty program** with points and rewards
- **Advanced reporting** with sales analytics
- **Mobile app** for staff and customers
- **Payment gateway integration** (Stripe, Square)
- **Printer integration** for receipts and kitchen tickets

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation

---

**Built with ❤️ for billiard parlor owners who want elegant, modern POS solutions.**
