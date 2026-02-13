import { Input } from "@/registry/components/input/react/input";

export function InputDemo() {
    return (
        <div className="flow">
            <div className="flow">
                <Input type="email" placeholder="Default" />
                <Input type="email" placeholder="Primary" className="input-primary" />
                <Input type="email" placeholder="Neutral" className="input-neutral" />
                <Input type="email" placeholder="Accent" className="input-accent" />
                <Input type="email" placeholder="Error" aria-invalid="true" />
                <Input type="email" placeholder="Info" className="input-info" />
                <Input type="email" placeholder="Success" className="input-success" />
                <Input type="email" placeholder="Warning" className="input-warning" />
            </div>
            <div className="flow">
                <Input type="email" placeholder="Email" />
                <Input type="text" placeholder="Error" aria-invalid="true" />
                <Input type="password" placeholder="Password" />
                <Input type="number" placeholder="Number" />
                <Input type="file" placeholder="File" />
                <Input type="tel" placeholder="Tel" />
                <Input type="text" placeholder="Text" />
                <Input type="url" placeholder="URL" />
                <Input type="search" placeholder="Search" />
                <Input type="date" placeholder="Date" />
                <Input type="datetime-local" placeholder="Datetime Local" />
                <Input type="month" placeholder="Month" />
                <Input type="time" placeholder="Time" />
                <Input type="week" placeholder="Week" />
                <Input disabled placeholder="Disabled" />
                <Input type="range" placeholder="Range" />
                <Input type="color" placeholder="Color" />
            </div>
        </div>
    );
}
