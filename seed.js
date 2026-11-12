// ==============================================================================
// File: backend/seed.js
// Purpose: Database seeder for demoing, testing, and interview verification
// Run: npm run seed
// ==============================================================================

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Note = require('./models/Note');
const Post = require('./models/Post');

// Load environment variables
dotenv.config();

const seedData = async () => {
  try {
    console.log('[Seeding]: Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Seeding]: Connected.');

    // 1. Clear existing collections
    console.log('[Seeding]: Clearing existing data...');
    await User.deleteMany();
    await Note.deleteMany();
    await Post.deleteMany();

    // 2. Create Users with specific interests for Aggregation Scenario 1
    console.log('[Seeding]: Creating demo users with interests...');
    
    // Note: User.create triggers the pre('save') hook to hash passwords
    const admin = await User.create({
      name: 'System Admin',
      email: 'admin@example.com',
      password: 'Admin123!',
      role: 'admin',
      interests: ['chess', 'reading', 'technology'],
    });

    const alice = await User.create({
      name: 'Alice Johnson',
      email: 'alice@example.com',
      password: 'User123!',
      role: 'user',
      interests: ['chess', 'music', 'gaming'],
    });

    const bob = await User.create({
      name: 'Bob Smith',
      email: 'bob@example.com',
      password: 'User123!',
      role: 'user',
      interests: ['reading', 'hiking', 'technology'],
    });

    const charlie = await User.create({
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      password: 'User123!',
      role: 'user',
      interests: ['chess', 'hiking'],
    });

    console.log(`[Seeding]: Created 4 users (1 Admin, 3 Regular).`);

    // 3. Create Sample Notes
    console.log('[Seeding]: Creating notes for users...');
    await Note.create([
      {
        title: 'Admin Master Architecture Notes',
        content: 'System architecture review and microservices roadmap for 2026.',
        owner: admin._id,
      },
      {
        title: 'Alice Daily Standup Notes',
        content: 'Finished implementing the JWT authentication module today.',
        owner: alice._id,
      },
      {
        title: 'Alice Project Ideas',
        content: 'Explored MongoDB multikey indexes and compound indexes for fast query execution.',
        owner: alice._id,
      },
      {
        title: 'Bob Grocery List',
        content: 'Almond milk, coffee beans, dark chocolate, oats.',
        owner: bob._id,
      },
      {
        title: 'Charlie Weekend Plan',
        content: 'Hike to the mountain summit on Saturday morning.',
        owner: charlie._id,
      },
    ]);
    console.log('[Seeding]: Created 5 sample notes.');

    // 4. Create Sample Posts for Aggregation Scenario 2 ($lookup)
    console.log('[Seeding]: Creating public posts for users...');
    await Post.create([
      {
        title: 'Getting Started with MongoDB Aggregation Pipelines',
        content: 'Aggregation pipelines allow complex multi-stage data transformations directly in the database engine.',
        author: alice._id,
      },
      {
        title: 'Why Multikey Indexes are Great for Array Fields',
        content: 'When an index is placed on an array field such as interests, MongoDB creates index keys for every individual item.',
        author: alice._id,
      },
      {
        title: 'Top 5 Hiking Trails in the Valley',
        content: 'A summary of scenic trails with moderate elevation and beautiful viewpoints.',
        author: bob._id,
      },
      {
        title: 'Chess Strategies: The Sicilian Defense',
        content: 'An aggressive counter-attacking opening system against 1.e4.',
        author: charlie._id,
      },
    ]);
    console.log('[Seeding]: Created 4 sample posts.');

    console.log('\n================ SEED SUMMARY ================');
    console.log('Admin Account:   admin@example.com   / Admin123!');
    console.log('Alice Account:   alice@example.com   / User123!');
    console.log('Bob Account:     bob@example.com     / User123!');
    console.log('Charlie Account: charlie@example.com / User123!');
    console.log('==============================================\n');

    process.exit(0);
  } catch (error) {
    console.error('[Seeding Error]:', error);
    process.exit(1);
  }
};

seedData();
