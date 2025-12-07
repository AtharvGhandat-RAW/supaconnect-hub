import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const NotFound: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
            <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
            <p className="text-muted-foreground mb-8">The page you are looking for does not exist.</p>
            <Link to="/">
                <Button>Go Home</Button>
            </Link>
        </div>
    );
};

export default NotFound;
