// Update this page (the content is just a fallback if you fail to update the page)

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-primary">Welcome to EduHive</h1>
        <p className="text-xl text-muted-foreground max-w-md">
          Join the student community to share notes, past questions, and assignments
        </p>
        <div className="space-y-4">
          <a 
            href="/home" 
            className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors font-medium"
          >
            Enter EduHive
          </a>
          <a 
            href="/auth" 
            className="inline-flex items-center justify-center px-6 py-3 border border-border rounded-lg hover:bg-accent transition-colors font-medium"
          >
            Sign Up / Login
          </a>
          <p className="text-sm text-muted-foreground">
            Connect with students, share resources, and excel together
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
