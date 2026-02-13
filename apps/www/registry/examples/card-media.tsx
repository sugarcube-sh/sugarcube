import { Card, CardContent, CardMedia } from "@/registry/components/card/react/card";

export function CardMediaDemo() {
    return (
        <Card>
            <CardMedia>
                <img
                    src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=800&h=400&auto=format&fit=crop&ar=2:1&ixlib=rb-4.1.0"
                    alt="Mountain landscape"
                />
            </CardMedia>
            <CardContent>Card content.</CardContent>
        </Card>
    );
}
