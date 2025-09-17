# EduHive - Student Community Platform

## Overview

EduHive is a student-focused social media platform that enables students to connect, share educational resources, and build academic communities. The platform allows users to create posts, share notes, past questions, and assignments, while providing features like likes, bookmarks, comments, and search functionality. Students can organize content by school and course tags, making it easy to find relevant academic materials within their educational community.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18.3+ with TypeScript for type safety and modern component development
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Components**: Shadcn/UI component library built on Radix UI primitives for accessible, customizable components
- **Styling**: Tailwind CSS with custom design system using HSL color variables and CSS custom properties
- **Routing**: React Router with protected routes and layout components for navigation
- **State Management**: React Context for authentication state, TanStack React Query for server state management
- **Theme Support**: Next-themes for dark/light mode switching with system preference detection

### Backend Architecture
- **Database**: Supabase (PostgreSQL) for data persistence and real-time features
- **Authentication**: Supabase Auth for user management, session handling, and security
- **File Storage**: Supabase Storage for handling profile pictures and post attachments
- **API Layer**: Supabase client-side SDK for database operations and real-time subscriptions

### Data Models
- **Users/Profiles**: User authentication data linked to profile information including username, school, department, year
- **Posts**: Main content entities with text body, optional attachments, school/course tags, and engagement metrics
- **Interactions**: Like and bookmark systems for user engagement tracking
- **Comments**: Nested commenting system for post discussions

### Authentication & Authorization
- **Strategy**: Supabase Auth with email/password authentication
- **Session Management**: Automatic session handling with refresh tokens
- **Route Protection**: Higher-order component pattern for protecting authenticated routes
- **User Context**: React Context providing global access to user state and authentication methods

### Component Architecture
- **Layout System**: Responsive layout with desktop sidebar and mobile bottom navigation
- **Design System**: Consistent theming with CSS custom properties and variant-based component styling
- **Responsive Design**: Mobile-first approach with breakpoint-specific layouts
- **Reusable Components**: Modular component library for posts, navigation, forms, and UI elements

## External Dependencies

### Core Infrastructure
- **Supabase**: Backend-as-a-Service providing PostgreSQL database, authentication, real-time subscriptions, and file storage
- **Vercel/Hosting Platform**: Deployment and hosting for the React application

### UI & Styling Libraries
- **Radix UI**: Unstyled, accessible component primitives for complex UI components
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Lucide React**: Icon library for consistent iconography
- **Next Themes**: Theme management system for dark/light mode support

### Development & Build Tools
- **TypeScript**: Static type checking and enhanced developer experience
- **ESLint**: Code linting with React and TypeScript rules
- **Vite**: Fast build tool and development server
- **React Hook Form**: Form state management and validation
- **Date-fns**: Date manipulation and formatting utilities

### State Management & Data Fetching
- **TanStack React Query**: Server state management, caching, and synchronization
- **React Context**: Client-side state management for authentication

### Additional Features
- **Web Share API**: Native sharing functionality for mobile devices
- **File Upload**: Support for images and PDFs with client-side validation
- **Real-time Updates**: Supabase real-time subscriptions for live data updates