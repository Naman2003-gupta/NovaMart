const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const seedDB = require('./seed/productSeeds');
const syncPinecone = require('./sync/syncPinecone');

const productRoutes = require('./routes/products');
const checkoutRoutes = require('./routes/checkout');
const orderRoutes = require('./routes/orders');
const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');

const {
  setupSwaggerUi,
  setupSwaggerJson
} = require('./docs/swagger');

// App Init
const app = express();
const PORT = process.env.PORT || 8000;

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= DATABASE =================
async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing in .env file');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');

    // ================= SEED DATABASE =================
    const skipSeed = process.env.SKIP_SEED_ON_START === 'true';

    if (!skipSeed) {
      try {
        const forceSeed = process.env.FORCE_SEED_ON_START === 'true';
        const result = await seedDB({
          force: forceSeed,
          skipIfExists: !forceSeed,
        });

        if (result?.seeded) console.log('🪴 Database seeded');
        else if (result?.skipped) console.log('🌱 Seed skipped');
      } catch (err) {
        console.error('❌ Seeding error:', err.message);
      }
    }

    // ================= OPTIONAL PINECONE =================
    if (process.env.ENABLE_PINECONE === 'true') {
      try {
        await syncPinecone();
        console.log('✅ Pinecone synced');
      } catch (err) {
        console.warn(
          '⚠️ Pinecone disabled or misconfigured. Using fallback search.'
        );
      }
    }

    // ================= ROUTES =================
    app.get('/', (req, res) => res.redirect('/api-docs'));

    setupSwaggerJson(app);
    setupSwaggerUi(app);

    app.use('/api/products', productRoutes);
    app.use('/api/checkout', checkoutRoutes);
    app.use('/api/orders', orderRoutes);
    app.use('/api/search', searchRoutes);
    app.use('/api/auth', authRoutes);

    // ================= SERVER =================
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('❌ Server startup failed:', err.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
