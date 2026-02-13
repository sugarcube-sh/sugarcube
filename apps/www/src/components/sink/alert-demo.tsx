import {
    AlertCircleIcon,
    BookmarkCheckIcon,
    CheckCircle2Icon,
    GiftIcon,
    InfoIcon,
    PopcornIcon,
    ShieldAlertIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/registry/components/alert/react/alert";
import { Button } from "@/registry/components/button/react/button";

export function AlertDemo() {
    return (
        <div className="flow" style={{ "maxWidth": "36rem" } as React.CSSProperties}>
            <Alert className="alert-outline">
                <CheckCircle2Icon />
                <AlertTitle>Success! Your changes have been saved</AlertTitle>
                <AlertDescription>
                    This is an alert with icon, title and description.
                </AlertDescription>
            </Alert>
            <Alert className="alert-outline">
                <BookmarkCheckIcon>Heads up!</BookmarkCheckIcon>
                <AlertDescription>
                    This one has an icon and a description only. No title.
                </AlertDescription>
            </Alert>
            <Alert className="alert-outline">
                <AlertDescription>
                    This one has a description only. No title. No icon.
                </AlertDescription>
            </Alert>
            <Alert className="alert-outline">
                <PopcornIcon />
                <AlertTitle>Let&apos;s try one with icon and title.</AlertTitle>
            </Alert>
            <Alert className="alert-outline">
                <ShieldAlertIcon />
                <AlertTitle>
                    This is a very long alert title that demonstrates how the component handles
                    extended text content and potentially wraps across multiple lines
                </AlertTitle>
            </Alert>
            <Alert className="alert-outline">
                <GiftIcon />
                <AlertDescription>
                    This is a very long alert description that demonstrates how the component
                    handles extended text content and potentially wraps across multiple lines
                </AlertDescription>
            </Alert>
            <Alert className="alert-outline">
                <AlertCircleIcon />
                <AlertTitle>
                    This is an extremely long alert title that spans multiple lines to demonstrate
                    how the component handles very lengthy headings while maintaining readability
                    and proper text wrapping behavior
                </AlertTitle>
                <AlertDescription>
                    This is an equally long description that contains detailed information about the
                    alert. It shows how the component can accommodate extensive content while
                    preserving proper spacing, alignment, and readability across different screen
                    sizes and viewport widths. This helps ensure the user experience remains
                    consistent regardless of the content length.
                </AlertDescription>
            </Alert>
            <Alert className="alert-error alert-outline">
                <AlertCircleIcon />
                <AlertTitle>Something went wrong!</AlertTitle>
                <AlertDescription>Your session has expired. Please log in again.</AlertDescription>
            </Alert>
            <Alert className="alert-error">
                <AlertCircleIcon />
                <AlertTitle>Unable to process your payment.</AlertTitle>
                <AlertDescription>
                    <p>Please verify your billing information and try again.</p>
                    <ul className="list-inside">
                        <li>Check your card details</li>
                        <li>Ensure sufficient funds</li>
                        <li>Verify billing address</li>
                    </ul>
                </AlertDescription>
            </Alert>
            <Alert className="alert-error alert-soft">
                <AlertCircleIcon />
                <AlertTitle>Something went wrong!</AlertTitle>
                <AlertDescription>Your session has expired. Please log in again.</AlertDescription>
            </Alert>
            <Alert className="alert-info alert-outline">
                <InfoIcon />
                <AlertTitle>Info! Your changes have been saved</AlertTitle>
                <AlertDescription>
                    This is an info alert with icon, title and description.
                </AlertDescription>
            </Alert>
            <Alert className="alert-info">
                <InfoIcon />
                <AlertTitle>Info! Your changes have been saved</AlertTitle>
                <AlertDescription>
                    This is an info alert with icon, title and description.
                </AlertDescription>
            </Alert>
            <Alert className="alert-info alert-soft">
                <InfoIcon />
                <AlertTitle>Info! Your changes have been saved</AlertTitle>
                <AlertDescription>
                    This is an info alert with icon, title and description.
                </AlertDescription>
            </Alert>
            <Alert className="alert-success alert-outline">
                <CheckCircle2Icon />
                <AlertTitle>The selected emails have been marked as spam.</AlertTitle>
                <Button>Undo</Button>
            </Alert>
            <Alert className="alert-success">
                <CheckCircle2Icon />
                <AlertTitle>Plot Twist: This Alert is Actually Amber!</AlertTitle>
                <AlertDescription>
                    This one has custom colors for light and dark mode.
                </AlertDescription>
            </Alert>
            <Alert className="alert-success alert-soft">
                <CheckCircle2Icon />
                <AlertTitle>Plot Twist: This Alert is Actually Amber!</AlertTitle>
                <AlertDescription>
                    This one has custom colors for light and dark mode.
                </AlertDescription>
            </Alert>
            <Alert className="alert-warning alert-outline">
                <AlertCircleIcon />
                <AlertTitle>Warning! Your changes have been saved</AlertTitle>
                <AlertDescription>
                    This is a warning alert with icon, title and description.
                </AlertDescription>
            </Alert>
            <Alert className="alert-warning">
                <AlertCircleIcon />
                <AlertTitle>Warning! Your changes have been saved</AlertTitle>
                <AlertDescription>
                    This is a warning alert with icon, title and description.
                </AlertDescription>
            </Alert>
            <Alert className="alert-warning alert-soft">
                <AlertCircleIcon />
                <AlertTitle>Warning! Your changes have been saved</AlertTitle>
                <AlertDescription>
                    This is a warning alert with icon, title and description.
                </AlertDescription>
            </Alert>
        </div>
    );
}
