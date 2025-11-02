# NestJS Hiring Test Backend

A comprehensive NestJS backend application implementing secure OTP authentication and intelligent World Cup predictions processing with high performance and scalability features.

## 🚀 Features

### Authentication System
- **SMS-based OTP Authentication** using SMS.ir service
- **Rate Limiting**: 1 OTP per 2 minutes per phone/IP
- **Session Management**: Secure token-based sessions (non-JWT)
- **Performance**: Sub-300ms response times for auth operations

### Prediction Processing System
- **6 Scoring Modes** for World Cup group predictions
- **Batch Processing**: Handles up to 5 million predictions
- **RabbitMQ Queues**: Scalable asynchronous processing
- **Redis Caching**: Optimized performance with intelligent caching

### Technical Stack
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis for temporary storage
- **Queue**: RabbitMQ for message processing
- **SMS Service**: SMS.ir integration
- **Documentation**: Swagger API documentation

## 📋 Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- RabbitMQ 3.12+

## 🛠 Installation & Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd nestjs-hiring
```

### 2. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your configurations
```

### 3. Using Docker (Recommended)
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### 4. Manual Installation
```bash
# Install dependencies
npm install

# Start infrastructure services
docker-compose up -d postgres redis rabbitmq

# Start development server
npm run start:dev
```

### 5. Database Migration (Required)
Run these SQL commands to migrate the predictions table structure:

```sql
-- Add backup column for predictions
ALTER TABLE predictions ADD COLUMN predict_backup jsonb;

-- Backup existing predict data
UPDATE predictions SET predict_backup = predict;

-- Transform predict column structure
UPDATE predictions
SET predict = (
  SELECT jsonb_object_agg(key, (
    SELECT jsonb_agg(elem->>0)
    FROM jsonb_array_elements(value) AS elem
  ))
  FROM jsonb_each(predict) AS grp(key, value)
);
```

Execute using Docker:
```bash
# Connect to PostgreSQL container
docker-compose exec postgres psql -U postgres -d nestjs_hiring_test

# Then run the SQL commands above
```

## 🔧 Environment Variables

### Application Configuration
```env
# Application
NODE_ENV=development          # Environment mode (development/production/test)
PORT=3000                    # Server port

# Application Info
APP_NAME=NestJS Hiring Test  # Application name
APP_VERSION=1.0.0           # Application version
```

### Database Configuration
```env
# Database
DB_HOST=localhost           # PostgreSQL host
DB_PORT=5432               # PostgreSQL port
DB_USERNAME=postgres       # Database username
DB_PASSWORD=password       # Database password
DB_NAME=nestjs_hiring_test # Database name
```

### External Services
```env
# Redis
REDIS_HOST=localhost       # Redis host
REDIS_PORT=6379           # Redis port
REDIS_PASSWORD=           # Redis password (optional)

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672  # RabbitMQ connection URL

# SMS.ir Configuration
SMS_IR_API_KEY=your_sms_ir_api_key  # SMS.ir API key
SMS_IR_TEMPLATE_ID=805161           # SMS template ID
SMS_IR_BASE_URL=https://api.sms.ir  # SMS.ir base URL
```

### Security Configuration
```env
# Security
JWT_SECRET=your_jwt_secret    # JWT signing secret
BCRYPT_SALT_ROUNDS=12        # Password hashing rounds
```

### Rate Limiting Configuration
```env
# Rate Limiting
OTP_SEND_LIMIT_TTL=120       # OTP send cooldown (seconds)
OTP_VERIFY_ATTEMPTS_TTL=60   # OTP verify window (seconds)
OTP_VERIFY_MAX_ATTEMPTS=5    # Max OTP verify attempts
OTP_CODE_TTL=120            # OTP code validity (seconds)
```

### Prediction System Configuration
```env
# Prediction Configuration
IRAN_TEAM_ID=bf5556ec-a78d-4047-a0f5-7b34b07c21aa  # Iran team UUID for scoring
CORRECT_GROUPS_CACHE_KEY=correct_groups              # Redis cache key for groups
CORRECT_GROUPS_CACHE_TTL=3600                       # Cache TTL (seconds)
```

#### Prediction Environment Variables Explained:

- **IRAN_TEAM_ID**: The UUID identifier for Iran's national team, used in Mode 4 scoring (Iran group mates prediction). This should match the team ID in your database.

- **CORRECT_GROUPS_CACHE_KEY**: Redis cache key used to store the correct World Cup groups. This allows for quick retrieval without database queries during prediction processing.

- **CORRECT_GROUPS_CACHE_TTL**: Time-to-live for the correct groups cache in seconds (default: 3600 = 1 hour). After this time, the cache will be refreshed from the database.

## 📚 API Documentation

Once the application is running, access the Swagger documentation at:
- **Development**: http://localhost:3000/api/docs
- **Production**: https://your-domain.com/api/docs

### Key Endpoints

#### Authentication
```http
POST /api/v1/auth/send-otp
POST /api/v1/auth/verify-otp
GET /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/:sessionId
```

#### Predictions
```http
POST /api/v1/admin/trigger-prediction-process
GET /api/v1/prediction/result/:userId
```

## 🎯 Scoring Modes

The prediction system implements 6 scoring modes:

1. **Mode 1 (100 points)**: All 48 teams in correct groups
2. **Mode 2 (80 points)**: Only 2 teams with wrong positions
3. **Mode 3 (60 points)**: Only 3 teams with wrong positions
4. **Mode 4 (50 points)**: All group mates of Iran team correct
5. **Mode 5 (40 points)**: One complete group (4 teams) correct
6. **Mode 6 (20 points)**: 3 teams from one group correct

## 🔒 Security Features

- **Rate Limiting**: Multiple layers of rate limiting
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: TypeORM parameterized queries
- **CORS**: Configurable cross-origin resource sharing
- **Error Handling**: Secure error messages

## 🚀 Performance Optimizations

- **Response Time**: < 300ms for auth operations
- **Database Indexing**: Optimized queries with proper indexes
- **Redis Caching**: Intelligent caching strategies
- **Batch Processing**: 1000 predictions per worker
- **Connection Pooling**: Optimized database connections

## 🧪 Testing

```bash
# Unit tests
npm run test

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e

# Watch mode
npm run test:watch
```

## 📊 Database Schema

### Teams Table
```sql
- id (UUID, PK)
- fa_name (TEXT)
- eng_name (TEXT)
- order (INTEGER)
- group (TEXT, NULLABLE)
- flag (TEXT)
```

### Predictions Table
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- predict (JSONB)
```

### Prediction Results Table
```sql
- id (UUID, PK)
- prediction_id (UUID, FK)
- user_id (UUID, FK)
- total_score (INTEGER)
- details (JSONB)
- processed_at (TIMESTAMPTZ)
```

## 🔄 Scaling Considerations

### Current Capacity
- **Predictions**: 50,000 processed
- **Target**: 5 million predictions

### Scaling Strategies
- **Horizontal Scaling**: Multiple app instances
- **Queue Workers**: Dedicated processing workers
- **Database Sharding**: Partition by user_id
- **CDN Integration**: Static asset delivery
- **Load Balancing**: Nginx reverse proxy

## 🐳 Docker Deployment

### Production Deployment
```bash
# Build production image
docker build -t nestjs-hiring-test .

# Deploy with docker-compose
docker-compose -f docker-compose.yml up -d
```

### Health Checks
- **Application**: `GET /api/v1/health`
- **Database**: PostgreSQL connection check
- **Redis**: Ping command
- **RabbitMQ**: Management API status

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support and questions:
- Create an issue in the repository

---

**Note**: This is a hiring test project demonstrating advanced NestJS backend development with focus on performance, scalability, and security.