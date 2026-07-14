# CRM Backend API

A robust Node.js backend server for the CRM system, built with Express.js and MongoDB, providing RESTful API endpoints for managing companies, contacts, deals, tasks, and invoices.

## ✨ Features

- **RESTful API** - Complete CRUD operations for all entities
- **MongoDB Integration** - Efficient data storage with Mongoose ODM
- **PDF Generation** - Automatic invoice PDF creation
- **CORS Support** - Cross-origin resource sharing enabled
- **Scalable Architecture** - Modular design with controllers and routes

## 🛠 Tech Stack

- **Node.js** - JavaScript runtime environment
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **PDF-Kit** - PDF generation library
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

## 🚀 Installation & Setup

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn package manager

### 1. Clone the Repository

```bash
git clone https://github.com/saiganesh-sristla/CRM-backend.git
cd CRM-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
PORT=5000
MONGODB_URI=mongodb://192.168.1.29:27017/crm_db

# For MongoDB Atlas (optional)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/crm_db

# Additional optional configurations
NODE_ENV=development
```

### 4. Start MongoDB

If using local MongoDB:

```bash
mongod
```

### 5. Start the Server

```bash
npm start
```

The server will be available at `http://192.168.1.29:5000`

## 📁 Project Structure

```
server/
├── controllers/     # Business logic for each entity
├── models/         # Mongoose schemas and models
├── routes/         # API route definitions
├── utils/          # Helper functions and utilities
├── middleware/     # Custom middleware functions
├── index.js        # Application entry point
├── .env           # Environment variables
└── package.json   # Dependencies and scripts
```

## 📚 API Endpoints

### 🏢 Companies

- `GET /api/companies` - Get all companies
- `POST /api/companies` - Create new company
- `GET /api/companies/:id` - Get company by ID

### 👤 Contacts

- `GET /api/contacts` - Get all contacts
- `POST /api/contacts` - Create new contact
- `GET /api/contacts/:id` - Get contact by ID

### 💼 Deals

- `GET /api/deals` - Get all deals
- `POST /api/deals` - Create new deal
- `GET /api/deals/:id` - Get deal by ID
- `PUT /api/deals/:id` - Update deal

### ✅ Tasks

- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### 🧾 Invoices

- `GET /api/invoices` - Get all invoices
- `POST /api/invoices` - Create new invoice
- `GET /api/invoices/download/:id` - Get invoice by ID

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
