import { Card, CardContent } from "@/registry/components/card/react/card";

export function CardDemo() {
    return (
        <Card className="bg-teal-500">
            <CardContent>
                <figure
                    className="min-h-[264px] repel"
                    style={
                        {
                            "--repel-vertical-alignment": "start",
                            "--repel-direction": "column",
                        } as React.CSSProperties
                    }
                >
                    <blockquote className="text-4xl text-teal-950 font-weight-bold leading-none tracking-tight">
                        A book must be the axe for the frozen sea within us.
                    </blockquote>
                    <figcaption>
                        <cite className="font-weight-semibold text-teal-800">—Franz Kafka</cite>
                    </figcaption>
                </figure>
            </CardContent>
        </Card>
    );
}
