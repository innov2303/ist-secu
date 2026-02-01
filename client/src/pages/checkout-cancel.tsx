import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { Link } from "wouter";

export default function CheckoutCancel() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <XCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">
            Your payment has been cancelled. No amount has been charged.
          </p>
          <div className="flex flex-col gap-3">
            <Button asChild data-testid="button-return-home">
              <Link href="/">Back to Scripts</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
