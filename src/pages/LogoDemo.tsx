import React from 'react';
import { AnimatedLogo } from '@/components/ui/animated-logo';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const LogoDemo = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Button 
          onClick={() => navigate('/')} 
          className="mb-8"
          variant="outline"
        >
          ← Back to App
        </Button>
        
        <h1 className="text-3xl font-bold mb-8 text-center">EduHive Animated Logo Demo</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Different sizes */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Different Sizes</h2>
            
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-sm font-medium mb-4">Small (60px)</h3>
              <AnimatedLogo size={60} className="text-primary" />
            </div>
            
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-sm font-medium mb-4">Medium (100px)</h3>
              <AnimatedLogo size={100} className="text-primary" />
            </div>
            
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-sm font-medium mb-4">Large (150px)</h3>
              <AnimatedLogo size={150} className="text-primary" />
            </div>
          </div>
          
          {/* Different themes */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Different Colors</h2>
            
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-sm font-medium mb-4">Primary Color</h3>
              <AnimatedLogo size={100} className="text-primary" />
            </div>
            
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-sm font-medium mb-4">Green</h3>
              <AnimatedLogo size={100} className="text-green-600" />
            </div>
            
            <div className="bg-card p-6 rounded-lg border">
              <h3 className="text-sm font-medium mb-4">Blue</h3>
              <AnimatedLogo size={100} className="text-blue-600" />
            </div>
          </div>
        </div>
        
        {/* Loading Spinner Demo */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-6">Loading Spinner Component</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card p-8 rounded-lg border">
              <h3 className="text-sm font-medium mb-4">Default Loading</h3>
              <LoadingSpinner />
            </div>
            
            <div className="bg-card p-8 rounded-lg border">
              <h3 className="text-sm font-medium mb-4">Custom Text</h3>
              <LoadingSpinner text="Preparing your workspace..." size={100} />
            </div>
          </div>
        </div>
        
        {/* Animation Description */}
        <div className="mt-12 bg-muted p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Animation Details</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• The three leaves animate in sequence with a 0.33s delay between each</li>
            <li>• Each leaf scales down to 30% size and moves toward the center, then back out</li>
            <li>• The center circle pulses with a subtle scale and opacity change</li>
            <li>• The book at the bottom has a gentle floating animation</li>
            <li>• Full animation cycle: 2 seconds for leaves, 3 seconds for book</li>
            <li>• Perfect for loading states, splash screens, and brand representation</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LogoDemo;