# Secure Note-Taking REST API

A secure, high-performance REST API built for note-taking with Role-Based Access Control (RBAC), JWT authentication, explicit MongoDB indexing, and advanced aggregation pipelines.

---

## 🚀 Tech Stack

- **Runtime & Framework**: Node.js & Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Tokens (JWT)
- **Security**: Password hashing via `bcryptjs` (salt rounds: 10)
- **Testing**: In-memory database integration test via `mongodb-memory-server`

---

## 📌 Roles & Permissions (RBAC)

1. **User**:
   - Create, read, update, delete personal notes (`Note.owner == req.user._id`).
   - Create and read public community posts.
   - View aggregated user interest groups.
2. **Admin**:
   - Inherits all User capabilities.
   - View notes from **all** users across the platform.
   - Full User Management CRUD (list users with pagination, create user, update user, delete user).

---

## ⚡ Database Indexing Strategy (`schema.index`)

Per the specification, all indexes are explicitly defined using the `schema.index(...)` method so they are visible during review. **No unnecessary indexes exist**, avoiding memory overhead and slow write operations.

### 1. `User` Model
```javascript
// 1. Fast authentication and uniqueness enforcement (POST /api/auth/login)
userSchema.index({ email: 1 }, { unique: true });

// 2. Multikey index supporting Aggregation Scenario 1 (Group by Interests)
userSchema.index({ interests: 1 });

// 3. Supports Admin user listing sorted newest-first with pagination (GET /api/users)
userSchema.index({ createdAt: -1 });
```

### 2. `Note` Model
```javascript
// 1. Compound index supporting regular user note list query (Equality on owner -> Sort on createdAt)
// Follows MongoDB's ESR (Equality, Sort, Range) rule. Eliminates in-memory sort.
noteSchema.index({ owner: 1, createdAt: -1 });

// 2. Supports Admin listing all notes across all users sorted newest-first (GET /api/notes)
noteSchema.index({ createdAt: -1 });
```
*(Single note read `Note.findById(id)` is automatically supported by MongoDB's default unique primary index on `_id`)*

### 3. `Post` Model
```javascript
// 1. Compound index supporting Aggregation Scenario 2 ($lookup on foreignField 'author')
// Eliminates full collection scan (COLLSCAN) on posts when joining with user.
postSchema.index({ author: 1, createdAt: -1 });

// 2. Supports listing public posts sorted newest-first with pagination (GET /api/posts)
postSchema.index({ createdAt: -1 });
```

---

## 🧩 Aggregation Pipelines

### Scenario 1: Group by Interests
- **Constraint**: Exactly one `collection.aggregate()` call.
- **Index**: Multikey index on `interests: 1`.
- **Pipeline**:
```javascript
User.aggregate([
  // 1. Filter documents with valid interests array
  { $match: { interests: { $exists: true, $type: 'array', $ne: [] } } },
  // 2. Unwind the interests array (1 document per interest)
  { $unwind: '$interests' },
  // 3. Group by the unwound interest string and collect users
  {
    $group: {
      _id: '$interests',
      userCount: { $sum: 1 },
      users: {
        $push: {
          _id: '$_id',
          name: '$name',
          email: '$email',
          role: '$role',
        },
      },
    },
  },
  // 4. Sort alphabetically by interest name
  { $sort: { _id: 1 } },
  // 5. Clean output shape
  { $project: { _id: 0, interest: '$_id', userCount: 1, users: 1 } }
]);
```

### Scenario 2: User Posts ($lookup)
- **Constraint**: Single aggregation pipeline with a `$lookup` stage.
- **Index**: Foreign collection compound index on `posts: { author: 1, createdAt: -1 }`.
- **Pipeline**:
```javascript
Post.aggregate([
  // 1. Match posts by author ObjectId
  { $match: { author: new mongoose.Types.ObjectId(userId) } },
  // 2. Sort by newest first
  { $sort: { createdAt: -1 } },
  // 3. Join with users collection using $lookup
  {
    $lookup: {
      from: 'users',
      localField: 'author',
      foreignField: '_id',
      as: 'authorDetails',
    },
  },
  // 4. Unwind joined author array into single object
  { $unwind: '$authorDetails' },
  // 5. Project required fields and omit sensitive fields (password)
  {
    $project: {
      _id: 1,
      title: 1,
      content: 1,
      createdAt: 1,
      author: {
        _id: '$authorDetails._id',
        name: '$authorDetails.name',
        email: '$authorDetails.email',
        role: '$authorDetails.role',
        interests: '$authorDetails.interests',
      },
    },
  },
]);
```

---

## 📖 API Documentation

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new user (`name, email, password, role, interests`) |
| `POST` | `/api/auth/login` | Public | Authenticate user, returns JWT token |
| `GET` | `/api/auth/me` | Private | Get currently authenticated user profile |

### Notes (`/api/notes`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/notes` | Private | Create note (`title, content`) |
| `GET` | `/api/notes?page=1&limit=10` | Private | Paginated list (User: own notes, Admin: all notes) |
| `GET` | `/api/notes/:id` | Private | Get single note (owner or admin) |
| `PUT` | `/api/notes/:id` | Private | Update note (owner or admin) |
| `DELETE` | `/api/notes/:id` | Private | Delete note (owner or admin) |

### Community Posts (`/api/posts`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/posts` | Private | Create a public post |
| `GET` | `/api/posts?page=1&limit=10` | Public | Paginated list of public posts |
| `GET` | `/api/posts/:id` | Public | Get single post |
| `GET` | `/api/posts/user/:userId` | Public | **Aggregation Scenario 2 ($lookup)** |

### User Management & Aggregations (`/api/users`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/users/grouped-by-interests` | Private | **Aggregation Scenario 1 (Group by Interests)** |
| `GET` | `/api/users/:userId/posts` | Public | **Aggregation Scenario 2 ($lookup)** |
| `GET` | `/api/users?page=1&limit=10` | Admin Only | Paginated list of all users |
| `POST` | `/api/users` | Admin Only | Create user |
| `GET` | `/api/users/:id` | Admin Only | Get single user details |
| `PUT` | `/api/users/:id` | Admin Only | Update user |
| `DELETE` | `/api/users/:id` | Admin Only | Delete user |

---

## 🛠️ Local Development & Testing

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure `.env`**:
   Copy `.env.example` to `.env` and provide your MongoDB connection string (e.g. from MongoDB Atlas Free Tier):
   ```env
   PORT=5000
   MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/note_taking_db?retryWrites=true&w=majority
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRES_IN=7d
   ```
3. **Run Automated Integration Tests**:
   Verifies indexes, password hashing, RBAC, explain plans (`IXSCAN`), and aggregations using an in-memory MongoDB server:
   ```bash
   npm test
   ```
4. **Seed Database** (Populates Admin, Users, Notes, and Posts):
   ```bash
   npm run seed
   ```
5. **Start Development Server**:
   ```bash
   npm run dev
   ```
