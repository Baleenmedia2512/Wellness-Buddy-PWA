# Coach-Team Authentication System - High Level Design (HLD)

**Document Version**: 1.0  
**Created**: December 19, 2025  
**Status**: Design Specification  
**Related Document**: [COACH_TEAM_AUTHENTICATION_PLAN.md](./COACH_TEAM_AUTHENTICATION_PLAN.md)

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Architecture Design](#2-architecture-design)
3. [Data Model Design](#3-data-model-design)
4. [API Design](#4-api-design)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Notification System Design](#6-notification-system-design)
7. [OTP Management System](#7-otp-management-system)
8. [State Management](#8-state-management)
9. [Security Architecture](#9-security-architecture)
10. [Performance Considerations](#10-performance-considerations)
11. [Deployment Architecture](#11-deployment-architecture)

---

## 1. SYSTEM OVERVIEW

### 1.1 Purpose
Design a hierarchical coach network system where every user is a coach with their own team while also being able to join another coach's team as a member, creating infinite levels of organization.

### 1.2 Key Components
- **Post-Login Setup Module**: Team ID creation and upline coach selection
- **User Search Engine**: Search all users in the system
- **Approval Workflow Engine**: Request/approval/OTP validation pipeline
- **Team Management Module**: View and manage team members
- **Notification Service**: Multi-channel notification system
- **OTP Service**: Secure one-time password generation and validation

### 1.3 User Roles
```
┌─────────────────────────────────────────────────┐
│              EVERY USER IS A COACH              │
├─────────────────────────────────────────────────┤
│                                                 │
│  Role 1: Coach of Own Team (Primary)           │
│  - Has unique Team ID (shared with co-coach)   │
│  - Can recruit team members                     │
│  - Approves join requests                       │
│                                                 │
│  Role 2: Co-Coach (Optional)                    │
│  - Shares Team ID with partner                  │
│  - Equal privileges as coach                    │
│                                                 │
│  Role 3: Team Member (Secondary)                │
│  - Member of ONE upline coach's team            │
│  - Still maintains own team/Team ID             │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 2. ARCHITECTURE DESIGN

### 2.1 System Architecture (3-Tier)

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  React Frontend (PWA)                                        │
│  ├── Setup Wizard (Team ID + Upline Selection)              │
│  ├── User Search UI                                          │
│  ├── Team Management Dashboard                              │
│  ├── Approval Module (Coach View)                           │
│  ├── OTP Validation Screen                                  │
│  └── Notification Center                                    │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │ REST API / WebSocket
┌──────────────────────┴───────────────────────────────────────┐
│                     APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Next.js Backend API                                         │
│  ├── Team Management Service                                │
│  ├── User Search Service                                     │
│  ├── Approval Workflow Service                              │
│  ├── OTP Service                                            │
│  ├── Notification Service                                   │
│  ├── Authentication Middleware                              │
│  └── Authorization Middleware                               │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │ SQL Queries
┌──────────────────────┴───────────────────────────────────────┐
│                       DATA LAYER                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Database (MySQL/PostgreSQL)                                 │
│  ├── users (with team_id, upline_coach_id)                  │
│  ├── teams                                                   │
│  ├── team_members                                            │
│  ├── approval_requests                                       │
│  ├── notifications                                           │
│  └── otp_records                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Component Interaction Flow

```
┌─────────┐     ┌──────────┐     ┌──────────────┐     ┌─────────┐
│  User   │────▶│ Frontend │────▶│   Backend    │────▶│   DB    │
│ Browser │     │   (React)│     │  (Next.js)   │     │ (MySQL) │
└─────────┘     └──────────┘     └──────────────┘     └─────────┘
     ▲               │                   │                  │
     │               │                   │                  │
     │               ▼                   ▼                  │
     │          ┌──────────┐      ┌──────────┐            │
     └──────────│Notification│◀────│   OTP    │◀───────────┘
                │  Service  │     │ Service  │
                └──────────┘      └──────────┘
                     │
                     ▼
                ┌──────────┐
                │  Email   │
                │ Service  │
                └──────────┘
```

---

## 3. DATA MODEL DESIGN

### 3.1 Entity Relationship Diagram (ERD)

```
┌─────────────────────────┐
│        users            │
├─────────────────────────┤
│ PK id                   │
│    username (unique)    │
│    email                │
│    password_hash        │
│ UK team_id (10 chars)   │◀──────┐
│ FK upline_coach_id ─────┼──┐    │
│    is_cocoach (boolean) │  │    │
│    status               │  │    │
│    created_at           │  │    │
└─────────────────────────┘  │    │
         │  │                 │    │
         │  └─────────────────┘    │
         │                         │
         │ Creates                 │ Shares
         ▼                         │
┌─────────────────────────┐       │
│        teams            │       │
├─────────────────────────┤       │
│ PK id                   │       │
│ UK team_id (10 chars)───┼───────┘
│ FK coach_1_id           │
│ FK coach_2_id (nullable)│
│    created_at           │
│    status               │
└─────────────────────────┘
         │
         │ Has
         ▼
┌─────────────────────────┐
│    team_members         │
├─────────────────────────┤
│ PK id                   │
│ FK coach_id (users.id)  │◀── Upline Coach
│ FK member_id (users.id) │◀── Downline Member
│    joined_at            │
│    status               │
│ UK (coach_id, member_id)│
└─────────────────────────┘
         │
         │ Triggered by
         ▼
┌─────────────────────────┐
│   approval_requests     │
├─────────────────────────┤
│ PK id                   │
│ FK requester_id         │◀── Coach requesting to join
│ FK upline_coach_id      │◀── Coach being requested
│    status (enum)        │
│    requested_at         │
│    processed_at         │
│    otp_hash             │
│    otp_expires_at       │
│    otp_attempts         │
│ UK (requester_id) ──────┼─── Only 1 pending per user
└─────────────────────────┘
         │
         │ Generates
         ▼
┌─────────────────────────┐
│    notifications        │
├─────────────────────────┤
│ PK id                   │
│ FK user_id              │
│    type (enum)          │
│    content (JSON)       │
│    read (boolean)       │
│    created_at           │
└─────────────────────────┘
```

### 3.2 Database Schema Details

#### 3.2.1 users Table
```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    team_id VARCHAR(10) UNIQUE,
    upline_coach_id BIGINT,
    is_cocoach BOOLEAN DEFAULT FALSE,
    status ENUM('pending_setup', 'active', 'inactive') DEFAULT 'pending_setup',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (upline_coach_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_team_id (team_id),
    INDEX idx_upline_coach_id (upline_coach_id),
    INDEX idx_username (username),
    INDEX idx_status (status)
);
```

#### 3.2.2 teams Table
```sql
CREATE TABLE teams (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    team_id VARCHAR(10) UNIQUE NOT NULL,
    coach_1_id BIGINT NOT NULL,
    coach_2_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive') DEFAULT 'active',
    
    FOREIGN KEY (coach_1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (coach_2_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_team_id (team_id),
    INDEX idx_coach_1_id (coach_1_id),
    INDEX idx_coach_2_id (coach_2_id),
    CONSTRAINT chk_different_coaches CHECK (coach_1_id != coach_2_id)
);
```

#### 3.2.3 team_members Table
```sql
CREATE TABLE team_members (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    coach_id BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'active', 'removed') DEFAULT 'active',
    
    FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_coach_member (coach_id, member_id),
    INDEX idx_coach_id (coach_id),
    INDEX idx_member_id (member_id),
    INDEX idx_status (status),
    CONSTRAINT chk_no_self_membership CHECK (coach_id != member_id)
);
```

#### 3.2.4 approval_requests Table
```sql
CREATE TABLE approval_requests (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    requester_id BIGINT NOT NULL,
    upline_coach_id BIGINT NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'cancelled', 'expired') DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    otp_hash VARCHAR(255),
    otp_expires_at TIMESTAMP NULL,
    otp_attempts INT DEFAULT 0,
    rejection_reason TEXT,
    
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (upline_coach_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_requester_id (requester_id),
    INDEX idx_upline_coach_id (upline_coach_id),
    INDEX idx_status (status),
    INDEX idx_otp_expires_at (otp_expires_at),
    CONSTRAINT chk_no_self_request CHECK (requester_id != upline_coach_id),
    UNIQUE KEY uk_pending_requester (requester_id, status) 
        WHERE status = 'pending'
);
```

#### 3.2.5 notifications Table
```sql
CREATE TABLE notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    type ENUM(
        'approval_request_received',
        'approval_granted',
        'approval_rejected',
        'otp_sent',
        'member_joined',
        'member_left',
        'cocoach_added'
    ) NOT NULL,
    content JSON NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_read (read),
    INDEX idx_created_at (created_at)
);
```

### 3.3 Data Integrity Constraints

**Business Rules Enforced at DB Level:**
1. ✅ `team_id` must be unique across all users
2. ✅ Only 2 coaches per `team_id` (in teams table)
3. ✅ User cannot be their own upline coach
4. ✅ User cannot be member of their own team
5. ✅ Only ONE pending approval request per user (unique constraint)
6. ✅ Coach IDs in teams table must be different

**Application-Level Validation:**
1. ⚠️ Circular hierarchy prevention (A → B → C → A)
2. ⚠️ Team ID format validation (10 alphanumeric)
3. ⚠️ OTP expiry and attempt limits
4. ⚠️ User cannot select someone from their downline as upline

---

## 4. API DESIGN

### 4.1 API Architecture

**Style**: RESTful API  
**Authentication**: JWT Bearer Token  
**Response Format**: JSON  
**Error Handling**: Standard HTTP Status Codes

### 4.2 API Endpoints Specification

#### 4.2.1 User Setup & Team Creation

**POST /api/team/create**
```javascript
// Create new Team ID
Request:
{
  "teamId": "ABC123XYZ0" // Optional, auto-generate if not provided
}

Response: 201 Created
{
  "success": true,
  "data": {
    "teamId": "ABC123XYZ0",
    "coach_id": 123,
    "created_at": "2025-12-19T10:30:00Z"
  }
}

Errors:
- 409 Conflict: Team ID already exists
- 400 Bad Request: Invalid Team ID format
```

**POST /api/team/join-cocoach**
```javascript
// Join existing team as co-coach
Request:
{
  "teamId": "ABC123XYZ0"
}

Response: 200 OK
{
  "success": true,
  "data": {
    "teamId": "ABC123XYZ0",
    "coach_1_id": 123,
    "coach_2_id": 456,
    "role": "cocoach"
  }
}

Errors:
- 404 Not Found: Team ID doesn't exist
- 409 Conflict: Team already has 2 coaches
- 400 Bad Request: Cannot join own team
```

**GET /api/team/validate/:teamId**
```javascript
// Validate Team ID availability
Response: 200 OK
{
  "exists": true,
  "hasSpace": true, // Can add co-coach
  "coachCount": 1
}
```

#### 4.2.2 User Search

**GET /api/users/search?q={username}&page={page}&limit={limit}**
```javascript
// Search ALL users in the system
Response: 200 OK
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 789,
        "username": "john_coach",
        "email_masked": "jo***h@gmail.com",
        "team_id": "XYZ789ABC",
        "team_size": 15,
        "profile_picture": "url",
        "created_at": "2025-01-15T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}

Query Parameters:
- q: Search query (username)
- page: Page number (default: 1)
- limit: Results per page (default: 20, max: 50)

Notes:
- Excludes current user from results
- Email is masked (first 2 + last 1 chars)
- Results are paginated
```

#### 4.2.3 Approval Workflow

**POST /api/upline/request**
```javascript
// Request to join upline coach's team
Request:
{
  "uplineCoachId": 789
}

Response: 201 Created
{
  "success": true,
  "data": {
    "requestId": 456,
    "uplineCoachId": 789,
    "status": "pending",
    "requested_at": "2025-12-19T11:00:00Z"
  }
}

Errors:
- 400 Bad Request: Already have pending request
- 400 Bad Request: Cannot request self
- 400 Bad Request: Already a member of this coach's team
- 400 Bad Request: Circular hierarchy detected
- 404 Not Found: Upline coach doesn't exist
```

**GET /api/upline/my-request**
```javascript
// Get current user's pending request status
Response: 200 OK
{
  "success": true,
  "data": {
    "requestId": 456,
    "uplineCoach": {
      "id": 789,
      "username": "john_coach",
      "email_masked": "jo***h@gmail.com"
    },
    "status": "pending",
    "requested_at": "2025-12-19T11:00:00Z"
  }
}

Response: 404 Not Found (if no pending request)
```

**DELETE /api/upline/request**
```javascript
// Cancel pending request
Response: 200 OK
{
  "success": true,
  "message": "Request cancelled successfully"
}
```

**GET /api/team/pending-requests**
```javascript
// Get pending team member requests (Coach-only)
Response: 200 OK
{
  "success": true,
  "data": {
    "requests": [
      {
        "requestId": 456,
        "requester": {
          "id": 123,
          "username": "new_coach",
          "email": "new_coach@example.com",
          "team_id": "DEF456GHI",
          "team_size": 0,
          "profile_picture": "url"
        },
        "requested_at": "2025-12-19T11:00:00Z"
      }
    ],
    "total": 5
  }
}

Authorization: Only coaches can access this
```

**POST /api/team/approve-request**
```javascript
// Approve or reject team member request
Request:
{
  "requestId": 456,
  "action": "approve", // or "reject"
  "rejectionReason": "Optional reason for rejection"
}

Response: 200 OK (Approve)
{
  "success": true,
  "data": {
    "requestId": 456,
    "status": "approved",
    "otp_sent": true,
    "otp_expires_at": "2025-12-19T11:15:00Z"
  }
}

Response: 200 OK (Reject)
{
  "success": true,
  "data": {
    "requestId": 456,
    "status": "rejected"
  }
}

Errors:
- 403 Forbidden: Not the upline coach for this request
- 404 Not Found: Request doesn't exist
- 400 Bad Request: Request already processed
```

**POST /api/upline/validate-otp**
```javascript
// Validate OTP after approval
Request:
{
  "requestId": 456,
  "otp": "123456"
}

Response: 200 OK
{
  "success": true,
  "message": "OTP validated successfully",
  "data": {
    "uplineCoach": {
      "id": 789,
      "username": "john_coach"
    },
    "joined_at": "2025-12-19T11:10:00Z"
  }
}

Errors:
- 400 Bad Request: Invalid OTP
- 400 Bad Request: OTP expired
- 429 Too Many Requests: Max attempts exceeded
- 404 Not Found: Request not found or not approved
```

**POST /api/upline/resend-otp**
```javascript
// Resend OTP (with cooldown)
Request:
{
  "requestId": 456
}

Response: 200 OK
{
  "success": true,
  "message": "OTP resent successfully",
  "otp_expires_at": "2025-12-19T11:25:00Z"
}

Errors:
- 429 Too Many Requests: Wait 60 seconds before resending
- 400 Bad Request: Max OTP generations exceeded (3)
```

#### 4.2.4 Team Management

**GET /api/team/my-members?page={page}&limit={limit}**
```javascript
// Get direct team members (downline)
Response: 200 OK
{
  "success": true,
  "data": {
    "members": [
      {
        "id": 123,
        "username": "member_coach",
        "email": "member@example.com",
        "team_id": "MEM123BER",
        "team_size": 8,
        "joined_at": "2025-11-01T00:00:00Z",
        "status": "active"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1
    },
    "teamStats": {
      "totalMembers": 15,
      "activeMembers": 14,
      "recentJoins": 3 // Last 7 days
    }
  }
}
```

**GET /api/team/my-upline**
```javascript
// Get upline coach info
Response: 200 OK
{
  "success": true,
  "data": {
    "uplineCoach": {
      "id": 789,
      "username": "john_coach",
      "email": "john@example.com",
      "team_id": "JOHN789XYZ",
      "joined_at": "2025-10-01T00:00:00Z"
    }
  }
}

Response: 404 Not Found (if no upline)
```

**POST /api/team/leave-upline**
```javascript
// Leave current upline coach's team
Response: 200 OK
{
  "success": true,
  "message": "Left team successfully"
}

Errors:
- 404 Not Found: No upline coach to leave
```

**DELETE /api/team/remove-member/:memberId**
```javascript
// Remove a team member (Coach-only)
Response: 200 OK
{
  "success": true,
  "message": "Member removed successfully"
}

Errors:
- 403 Forbidden: Not a coach or not this member's coach
- 404 Not Found: Member not in your team
```

#### 4.2.5 User Status

**GET /api/user/status**
```javascript
// Get current user's setup status
Response: 200 OK
{
  "success": true,
  "data": {
    "hasTeamId": true,
    "teamId": "ABC123XYZ0",
    "hasUpline": true,
    "uplineCoachId": 789,
    "isCocoach": false,
    "cocoachPartner": null,
    "setupComplete": true,
    "pendingApproval": false,
    "status": "active"
  }
}

Usage: Determine which setup step to show user
```

### 4.3 API Response Standards

**Success Response Format:**
```javascript
{
  "success": true,
  "data": { /* Response data */ },
  "message": "Optional success message"
}
```

**Error Response Format:**
```javascript
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* Optional additional details */ }
  }
}
```

**HTTP Status Codes:**
- `200 OK`: Successful GET, PUT, DELETE
- `201 Created`: Successful POST (resource created)
- `400 Bad Request`: Invalid input/validation error
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized for this action
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., duplicate Team ID)
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## 5. AUTHENTICATION & AUTHORIZATION

### 5.1 Authentication Flow

```
┌─────────┐                                    ┌─────────┐
│  User   │                                    │ Backend │
└────┬────┘                                    └────┬────┘
     │                                              │
     │ 1. Login (username, password)               │
     │────────────────────────────────────────────▶│
     │                                              │
     │         2. Validate credentials             │
     │                                         ┌────┴────┐
     │                                         │   DB    │
     │                                         └────┬────┘
     │                                              │
     │ 3. JWT Token + User Info                    │
     │◀────────────────────────────────────────────│
     │                                              │
     │ 4. Subsequent requests with JWT             │
     │────────────────────────────────────────────▶│
     │         (Authorization: Bearer <token>)     │
     │                                              │
     │ 5. Verify JWT & Extract user_id             │
     │                                              │
     │ 6. Response with authorized data            │
     │◀────────────────────────────────────────────│
     │                                              │
```

### 5.2 JWT Token Structure

```javascript
// JWT Payload
{
  "userId": 123,
  "username": "john_coach",
  "teamId": "ABC123XYZ0",
  "isCocoach": false,
  "status": "active",
  "iat": 1734345600, // Issued at
  "exp": 1734432000  // Expires (24 hours)
}
```

### 5.3 Authorization Matrix

| Endpoint | Public | User | Coach | Co-Coach | Admin |
|----------|--------|------|-------|----------|-------|
| POST /api/team/create | ❌ | ✅ | ✅ | ✅ | ✅ |
| POST /api/team/join-cocoach | ❌ | ✅ | ✅ | ✅ | ✅ |
| GET /api/users/search | ❌ | ✅ | ✅ | ✅ | ✅ |
| POST /api/upline/request | ❌ | ✅ | ✅ | ✅ | ✅ |
| GET /api/team/pending-requests | ❌ | ❌ | ✅ | ✅ | ✅ |
| POST /api/team/approve-request | ❌ | ❌ | ✅ (own team) | ✅ (own team) | ✅ |
| DELETE /api/team/remove-member | ❌ | ❌ | ✅ (own team) | ✅ (own team) | ✅ |

### 5.4 Middleware Chain

```javascript
// API Request Flow
Request
  ↓
[1] CORS Middleware
  ↓
[2] Rate Limiting Middleware
  ↓
[3] JWT Authentication Middleware
  ↓
[4] User Status Check Middleware
  ↓
[5] Role Authorization Middleware
  ↓
[6] Route Handler
  ↓
[7] Response Formatter
  ↓
Response
```

---

## 6. NOTIFICATION SYSTEM DESIGN

### 6.1 Notification Architecture

```
┌──────────────────────────────────────────────────────────┐
│              Notification Trigger Events                  │
├──────────────────────────────────────────────────────────┤
│  • Approval request received                             │
│  • Request approved (with OTP)                           │
│  • Request rejected                                      │
│  • OTP expired                                           │
│  • Member joined team                                    │
│  • Member left team                                      │
│  • Co-coach added                                        │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  Notification Service  │
        └────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────┐          ┌──────────────┐
│   Database   │          │    Email     │
│ (In-App      │          │   Service    │
│  Storage)    │          │  (SendGrid)  │
└──────────────┘          └──────────────┘
        │                         │
        │                         │
        ▼                         ▼
┌──────────────┐          ┌──────────────┐
│  WebSocket/  │          │  User Email  │
│   Polling    │          │   Inbox      │
└──────────────┘          └──────────────┘
        │                         │
        └────────────┬────────────┘
                     │
                     ▼
              ┌────────────┐
              │    User    │
              └────────────┘
```

### 6.2 Notification Types

```javascript
// Notification Type Definitions
const NotificationTypes = {
  APPROVAL_REQUEST_RECEIVED: {
    channel: ['in-app', 'email'],
    priority: 'high',
    template: 'approval_request',
    recipients: ['upline_coach']
  },
  APPROVAL_GRANTED: {
    channel: ['in-app', 'email'],
    priority: 'high',
    template: 'approval_granted_with_otp',
    recipients: ['requester']
  },
  APPROVAL_REJECTED: {
    channel: ['in-app', 'email'],
    priority: 'medium',
    template: 'approval_rejected',
    recipients: ['requester']
  },
  MEMBER_JOINED: {
    channel: ['in-app'],
    priority: 'low',
    template: 'member_joined',
    recipients: ['coach', 'cocoach']
  },
  OTP_EXPIRED: {
    channel: ['in-app'],
    priority: 'medium',
    template: 'otp_expired',
    recipients: ['requester']
  }
};
```

### 6.3 Email Templates

**Approval Request Email (To Upline Coach):**
```
Subject: New Team Member Request from [Username]

Hi [Coach Name],

[Username] has requested to join your team!

Team Member Details:
- Username: [Username]
- Email: [Email]
- Team ID: [Their Team ID]
- Team Size: [X] members

Click here to review and approve:
[Link to Approval Page]

---
Wellness Buddy Team
```

**OTP Delivery Email (To Requester):**
```
Subject: Your Team Join Request Has Been Approved!

Hi [Username],

Great news! [Coach Name] has approved your request to join their team.

Your verification code: [123456]

This code expires in 15 minutes.

Enter this code here: [Link to OTP Page]

---
Wellness Buddy Team
```

---

## 7. OTP MANAGEMENT SYSTEM

### 7.1 OTP Generation & Validation Flow

```
┌─────────────────────────────────────────────────────────┐
│              Coach Approves Request                      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │   Generate 6-digit OTP  │
         │   (Crypto-secure random) │
         └─────────────┬────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │   Hash OTP (bcrypt)     │
         │   Store in DB           │
         │   Set expiry: +15 min   │
         └─────────────┬────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │   Send OTP via Email    │
         └─────────────┬────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │   User Enters OTP       │
         └─────────────┬────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │   Validate OTP:         │
         │   1. Check expiry       │
         │   2. Check attempts < 5 │
         │   3. Compare hash       │
         └─────────────┬────────────┘
                       │
          ┌────────────┴───────────┐
          │                        │
      ✅ Valid                 ❌ Invalid
          │                        │
          ▼                        ▼
┌──────────────────┐    ┌───────────────────┐
│ Mark Approved    │    │ Increment Attempts│
│ Add to Team      │    │ Return Error      │
│ Clear OTP        │    │ Lock at 5 attempts│
└──────────────────┘    └───────────────────┘
```

### 7.2 OTP Security Specifications

**Generation:**
- Algorithm: Crypto-secure random number generator
- Length: 6 digits (000000 - 999999)
- Uniqueness: Not strictly enforced (hash comparison handles collisions)

**Storage:**
- Hashing: bcrypt with salt rounds: 10
- Never store plain text OTP in database

**Expiry:**
- Default: 15 minutes
- Configurable per environment

**Attempt Limits:**
- Max validation attempts: 5
- After 5 failed attempts: Lock request, require new approval

**Rate Limiting:**
- OTP generation: Max 3 per approval request
- Resend cooldown: 60 seconds between resends
- Validation: Max 10 attempts per minute per IP

### 7.3 OTP Service API

```javascript
// Internal OTP Service Methods
class OTPService {
  async generateOTP(approvalRequestId) {
    // Generate 6-digit OTP
    // Hash and store in DB
    // Set expiry timestamp
    // Return plain OTP (for email)
  }
  
  async validateOTP(approvalRequestId, otpInput) {
    // Check expiry
    // Check attempts
    // Verify hash
    // Increment attempts on failure
    // Clear OTP on success
  }
  
  async resendOTP(approvalRequestId) {
    // Check cooldown
    // Check generation limit
    // Generate new OTP
    // Invalidate old OTP
  }
  
  async cleanupExpiredOTPs() {
    // Cron job: Run every hour
    // Delete expired OTP records
  }
}
```

---

## 8. STATE MANAGEMENT

### 8.1 Frontend State Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Global Application State               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Authentication State (Context/Redux)                    │
│  ├── user: { id, username, email, teamId }              │
│  ├── isAuthenticated: boolean                           │
│  ├── setupStatus: object                                │
│  └── token: JWT                                          │
│                                                          │
│  Setup Wizard State                                      │
│  ├── currentStep: enum                                   │
│  ├── teamIdCreated: boolean                              │
│  ├── uplineSelected: object | null                       │
│  ├── pendingRequest: object | null                       │
│  └── otpValidation: object                               │
│                                                          │
│  Team State                                              │
│  ├── myMembers: array                                    │
│  ├── pendingRequests: array                              │
│  ├── uplineCoach: object | null                          │
│  ├── cocoach: object | null                              │
│  └── teamStats: object                                   │
│                                                          │
│  Notification State                                      │
│  ├── notifications: array                                │
│  ├── unreadCount: number                                 │
│  └── lastFetched: timestamp                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Setup Wizard State Machine

```
┌──────────────┐
│   INITIAL    │
│ (New Login)  │
└───────┬──────┘
        │
        ▼
  ┌─────────────┐
  │ CHECK_STATUS│───────────────┐
  └─────┬───────┘               │
        │                       │ Already Setup
        │ No Team ID            ▼
        ▼              ┌────────────────┐
┌──────────────┐       │ COMPLETE_SETUP │
│ TEAM_SETUP   │       │  (Go to App)   │
│ Create/Join  │       └────────────────┘
└───────┬──────┘
        │
        │ Team ID Created
        ▼
┌──────────────┐
│ UPLINE_SEARCH│
│ Search Users │
└───────┬──────┘
        │
        │ Coach Selected
        ▼
┌──────────────┐
│REQUEST_SENT  │
│ Pending...   │
└───────┬──────┘
        │
        │ Approved
        ▼
┌──────────────┐
│ OTP_VALIDATE │
│ Enter Code   │
└───────┬──────┘
        │
        │ OTP Valid
        ▼
┌──────────────┐
│  COMPLETE    │
│ Access App   │
└──────────────┘
```

### 8.3 User Status Flow

```javascript
// User Status Enum
const UserStatus = {
  PENDING_SETUP: 'pending_setup',       // No Team ID
  PENDING_UPLINE: 'pending_upline',     // Has Team ID, no upline
  PENDING_APPROVAL: 'pending_approval',  // Waiting for coach approval
  PENDING_OTP: 'pending_otp',           // Approved, OTP sent
  ACTIVE: 'active',                     // Fully setup
  INACTIVE: 'inactive'                  // Deactivated
};

// Status Transitions
PENDING_SETUP → PENDING_UPLINE (Team ID created)
PENDING_UPLINE → PENDING_APPROVAL (Upline selected, request sent)
PENDING_APPROVAL → PENDING_OTP (Coach approved)
PENDING_OTP → ACTIVE (OTP validated)
ACTIVE → INACTIVE (Account deactivated)
```

---

## 9. SECURITY ARCHITECTURE

### 9.1 Security Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Network Security                               │
│ • HTTPS/TLS 1.3                                         │
│ • CORS Configuration                                    │
│ • DDoS Protection (Cloudflare)                          │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────────┐
│ Layer 2: API Security                                   │
│ • JWT Authentication                                    │
│ • Rate Limiting (per IP, per user)                      │
│ • Input Validation & Sanitization                       │
│ • SQL Injection Prevention (Parameterized Queries)      │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────────┐
│ Layer 3: Business Logic Security                        │
│ • Circular Hierarchy Prevention                         │
│ • Authorization Checks (own team only)                  │
│ • Data Access Controls                                  │
│ • Email Masking                                         │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────────┐
│ Layer 4: Data Security                                  │
│ • Password Hashing (bcrypt)                             │
│ • OTP Hashing (bcrypt)                                  │
│ • Database Encryption at Rest                           │
│ • PII Data Protection                                   │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Rate Limiting Strategy

```javascript
// Rate Limit Configuration
const rateLimits = {
  // Authentication
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5 // 5 attempts per window
  },
  
  // User Search
  userSearch: {
    windowMs: 60 * 1000, // 1 minute
    max: 30 // 30 requests per minute
  },
  
  // Approval Requests
  createRequest: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10 // 10 requests per hour
  },
  
  // OTP Operations
  otpValidation: {
    windowMs: 60 * 1000, // 1 minute
    max: 10 // 10 attempts per minute
  },
  
  otpResend: {
    windowMs: 60 * 1000, // 1 minute
    max: 1 // 1 resend per minute
  },
  
  // General API
  general: {
    windowMs: 60 * 1000, // 1 minute
    max: 100 // 100 requests per minute
  }
};
```

### 9.3 Circular Hierarchy Prevention

```javascript
// Algorithm to prevent circular hierarchy
async function checkCircularHierarchy(requesterId, uplineCoachId) {
  // Build upline chain for requester
  const requesterUplineChain = await getUplineChain(requesterId);
  
  // Build downline tree for requester
  const requesterDownlineTree = await getDownlineTree(requesterId);
  
  // Check if uplineCoachId is in requester's downline
  if (requesterDownlineTree.includes(uplineCoachId)) {
    throw new Error('Circular hierarchy detected: Cannot select your downline as upline');
  }
  
  return true;
}

// Recursive function to get all downline members
async function getDownlineTree(coachId, visited = new Set()) {
  if (visited.has(coachId)) return [];
  visited.add(coachId);
  
  const directMembers = await db.query(
    'SELECT member_id FROM team_members WHERE coach_id = ? AND status = "active"',
    [coachId]
  );
  
  let allDownline = directMembers.map(m => m.member_id);
  
  for (const member of directMembers) {
    const subDownline = await getDownlineTree(member.member_id, visited);
    allDownline = allDownline.concat(subDownline);
  }
  
  return allDownline;
}
```

### 9.4 Data Privacy Measures

**Email Masking:**
```javascript
function maskEmail(email) {
  const [localPart, domain] = email.split('@');
  
  if (localPart.length <= 3) {
    return `${localPart[0]}***@${domain}`;
  }
  
  const visibleStart = localPart.slice(0, 2);
  const visibleEnd = localPart.slice(-1);
  const maskedLength = localPart.length - 3;
  
  return `${visibleStart}${'*'.repeat(maskedLength)}${visibleEnd}@${domain}`;
}

// Examples:
// john@example.com → jo***n@example.com
// a@example.com → a***@example.com
// coach123@example.com → co*****3@example.com
```

**PII Data Access Control:**
- Full email only visible to:
  - Self
  - Upline coach (for communication)
  - System admins
- Masked email shown in:
  - User search results
  - Team member lists
  - Approval requests

---

## 10. PERFORMANCE CONSIDERATIONS

### 10.1 Database Optimization

**Indexes:**
```sql
-- Critical indexes for performance
CREATE INDEX idx_users_team_id ON users(team_id);
CREATE INDEX idx_users_upline_coach_id ON users(upline_coach_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_team_members_coach_id ON team_members(coach_id);
CREATE INDEX idx_team_members_member_id ON team_members(member_id);
CREATE INDEX idx_approval_requests_status ON approval_requests(status);
CREATE INDEX idx_approval_requests_upline_coach_id ON approval_requests(upline_coach_id);
CREATE INDEX idx_notifications_user_id_read ON notifications(user_id, read);

-- Composite indexes for common queries
CREATE INDEX idx_team_members_coach_status ON team_members(coach_id, status);
CREATE INDEX idx_approval_requests_upline_status ON approval_requests(upline_coach_id, status);
```

**Query Optimization:**
- Use pagination for all list endpoints
- Limit user search results (max 50 per page)
- Cache frequently accessed data (e.g., user profile)
- Use database connection pooling

### 10.2 Caching Strategy

```
┌────────────────────────────────────────────┐
│          Caching Layers                    │
├────────────────────────────────────────────┤
│                                            │
│  Browser Cache                             │
│  └── Static assets (images, CSS, JS)      │
│                                            │
│  Application Cache (Redis)                 │
│  ├── User profile data (TTL: 5 min)       │
│  ├── Team member counts (TTL: 15 min)     │
│  ├── Search results (TTL: 2 min)          │
│  └── User status (TTL: 5 min)             │
│                                            │
│  Database Query Cache                      │
│  └── MySQL query cache (if enabled)       │
│                                            │
└────────────────────────────────────────────┘
```

**Cache Invalidation:**
- User profile: Invalidate on update
- Team members: Invalidate on member join/leave
- Search results: Short TTL (2 min), frequent updates expected
- User status: Invalidate on status change

### 10.3 Scalability Considerations

**Horizontal Scaling:**
- Stateless API servers (scale horizontally)
- Load balancer (Nginx/AWS ALB)
- Database read replicas for search queries
- Redis for distributed caching

**Database Partitioning (Future):**
```sql
-- Partition team_members by coach_id ranges
-- If team sizes grow very large
ALTER TABLE team_members
PARTITION BY RANGE (coach_id) (
  PARTITION p0 VALUES LESS THAN (10000),
  PARTITION p1 VALUES LESS THAN (20000),
  PARTITION p2 VALUES LESS THAN (30000),
  ...
);
```

**Expected Load:**
- Total users: 10,000 (initial), 100,000 (1 year)
- Average team size: 10-20 members
- Search queries: ~100/minute during peak
- Approval workflow: ~50/hour during peak

---

## 11. DEPLOYMENT ARCHITECTURE

### 11.1 Deployment Diagram

```
┌────────────────────────────────────────────────────────────┐
│                        Internet                            │
└───────────────────────┬────────────────────────────────────┘
                        │
┌───────────────────────┴────────────────────────────────────┐
│                   CDN (Cloudflare)                         │
│                  Static Assets Delivery                    │
└───────────────────────┬────────────────────────────────────┘
                        │
┌───────────────────────┴────────────────────────────────────┐
│             Load Balancer (Nginx/AWS ALB)                  │
└───────────┬────────────────────────┬───────────────────────┘
            │                        │
┌───────────┴────────┐   ┌───────────┴────────┐
│   Frontend Server  │   │   Frontend Server  │
│   (React PWA)      │   │   (React PWA)      │
│   Port: 3000       │   │   Port: 3000       │
└────────────────────┘   └────────────────────┘
            │                        │
            └────────────┬───────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                   API Gateway                               │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
┌────────┴────────┐ ┌───┴──────────┐ ┌─┴────────────┐
│ Backend API #1  │ │ Backend API #2│ │ Backend API #3│
│ (Next.js)       │ │ (Next.js)     │ │ (Next.js)    │
│ Port: 4000      │ │ Port: 4000    │ │ Port: 4000   │
└────────┬────────┘ └───┬──────────┘ └─┬────────────┘
         │              │               │
         └──────────────┼───────────────┘
                        │
         ┌──────────────┴─────────────────┐
         │                                │
┌────────┴────────┐            ┌─────────┴──────────┐
│ Database (MySQL)│            │   Redis Cache      │
│  Primary (RW)   │            │  (Session/Cache)   │
└────────┬────────┘            └────────────────────┘
         │
    ┌────┴────┐
    │  Replica│
    │   (RO)  │
    └─────────┘
```

### 11.2 Environment Configuration

**Development:**
- Frontend: `localhost:3000`
- Backend: `localhost:4000`
- Database: `localhost:3306`
- Redis: `localhost:6379`

**Staging:**
- Frontend: `staging-wellness-buddy.vercel.app`
- Backend: `staging-api.wellness-buddy.com`
- Database: AWS RDS (MySQL)
- Redis: AWS ElastiCache

**Production:**
- Frontend: `wellness-buddy.com`
- Backend: `api.wellness-buddy.com`
- Database: AWS RDS (Multi-AZ, automated backups)
- Redis: AWS ElastiCache (Cluster mode)
- CDN: Cloudflare
- Monitoring: DataDog/New Relic

### 11.3 CI/CD Pipeline

```
┌──────────────┐
│  Developer   │
│  Push Code   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   GitHub     │
│  Repository  │
└──────┬───────┘
       │ Webhook
       ▼
┌──────────────────┐
│   CI Server      │
│  (GitHub Actions)│
├──────────────────┤
│ 1. Run Tests     │
│ 2. Build         │
│ 3. Code Quality  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Build Success? │
└──────┬───────────┘
       │ Yes
       ▼
┌──────────────────┐
│ Deploy to Staging│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Run E2E Tests   │
└──────┬───────────┘
       │ Pass
       ▼
┌──────────────────┐
│Manual Approval   │
│   (Production)   │
└──────┬───────────┘
       │ Approved
       ▼
┌──────────────────┐
│ Deploy to Prod   │
│ (Blue/Green)     │
└──────────────────┘
```

### 11.4 Database Migration Strategy

```bash
# Migration workflow
1. Create migration file: `YYYYMMDDHHMMSS_create_coach_team_tables.sql`
2. Test on development database
3. Apply to staging database
4. Run smoke tests
5. Apply to production (off-peak hours)
6. Monitor for errors
7. Rollback plan ready
```

**Rollback Strategy:**
- Keep previous 3 database backups
- Automated backup before each migration
- Rollback scripts for each migration
- Feature flags for gradual rollout

---

## 12. MONITORING & OBSERVABILITY

### 12.1 Key Metrics to Track

**System Metrics:**
- API response times (p50, p95, p99)
- Database query performance
- Error rates (4xx, 5xx)
- API throughput (requests/sec)
- Cache hit rates

**Business Metrics:**
- Setup completion rate
- Approval request volume
- Average approval time
- OTP validation success rate
- Team growth rate
- User search frequency

**Alerts:**
- API error rate > 5%
- Database connection pool exhausted
- OTP validation failure > 30%
- Disk space < 20%
- High memory usage > 85%

### 12.2 Logging Strategy

```javascript
// Log Levels
const LogLevels = {
  ERROR: 'error',   // System errors, exceptions
  WARN: 'warn',     // Warnings, deprecated usage
  INFO: 'info',     // Important events (user signup, approval)
  DEBUG: 'debug',   // Detailed debugging information
  TRACE: 'trace'    // Very detailed tracing
};

// Log Structure
{
  timestamp: '2025-12-19T12:00:00Z',
  level: 'info',
  service: 'coach-team-api',
  userId: 123,
  action: 'approval_request_created',
  details: {
    requesterId: 123,
    uplineCoachId: 456,
    requestId: 789
  },
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
}
```

---

## 13. TESTING STRATEGY

### 13.1 Test Pyramid

```
                  ┌────────────────┐
                  │   E2E Tests    │
                  │   (Cypress)    │
                  └────────────────┘
              ┌────────────────────────┐
              │  Integration Tests     │
              │     (Jest + API)       │
              └────────────────────────┘
          ┌──────────────────────────────────┐
          │       Unit Tests                 │
          │  (Jest + React Testing Library)  │
          └──────────────────────────────────┘
```

### 13.2 Test Coverage Targets

- Unit Tests: 80% code coverage
- Integration Tests: All critical API flows
- E2E Tests: Core user journeys

### 13.3 Critical Test Scenarios

**Setup Flow:**
1. New user creates Team ID
2. New user joins as co-coach
3. User searches for upline coach
4. User requests to join team
5. Coach approves request
6. User validates OTP
7. User successfully accesses app

**Approval Workflow:**
1. Coach receives notification
2. Coach views pending requests
3. Coach approves request (OTP sent)
4. Coach rejects request
5. User cancels request after sending
6. Multiple users request same coach

**OTP Validation:**
1. Valid OTP within expiry
2. Expired OTP
3. Invalid OTP (wrong code)
4. Max attempts exceeded
5. Resend OTP functionality

**Edge Cases:**
1. Circular hierarchy prevention
2. Duplicate Team ID prevention
3. Co-coach slot already filled
4. User tries to select self as upline
5. Upline coach deleted/deactivated

---

## 14. APPENDIX

### 14.1 Glossary

- **Coach**: Every user in the system
- **Team ID**: 10-character alphanumeric identifier for a coach/co-coach pair
- **Upline Coach**: The coach whose team you join (your parent in hierarchy)
- **Downline Member**: A coach who has joined your team (your team member)
- **Co-Coach**: Partner who shares the same Team ID
- **Approval Request**: Request to join an upline coach's team
- **OTP**: One-Time Password for approval verification

### 14.2 Technology Stack Summary

**Frontend:**
- React 18
- React Router
- Axios (API calls)
- Tailwind CSS
- PWA (Progressive Web App)

**Backend:**
- Next.js (API Routes)
- Node.js 18+
- JWT for authentication
- bcrypt for password/OTP hashing

**Database:**
- MySQL 8.0 or PostgreSQL 14+
- Redis (caching)

**Email:**
- SendGrid/AWS SES

**Hosting:**
- Frontend: Vercel/Netlify
- Backend: AWS EC2/ECS
- Database: AWS RDS
- Cache: AWS ElastiCache

**Monitoring:**
- DataDog or New Relic
- Sentry (error tracking)

### 14.3 References

- [COACH_TEAM_AUTHENTICATION_PLAN.md](./COACH_TEAM_AUTHENTICATION_PLAN.md) - Detailed feature plan
- JWT Best Practices: https://jwt.io/introduction
- OTP Security: NIST SP 800-63B
- API Security: OWASP API Security Top 10

---

**End of High Level Design Document**

**Prepared by**: Development Team  
**Date**: December 19, 2025  
**Version**: 1.0  
**Status**: Ready for Implementation
