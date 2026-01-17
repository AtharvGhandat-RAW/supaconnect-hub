import React, { useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, X } from 'lucide-react';
import { printPDF } from '@/utils/export';
import { toast } from '@/hooks/use-toast';

interface ReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  htmlContent: string;
}

const ReportPreviewDialog: React.FC<ReportPreviewDialogProps> = ({
  open,
  onOpenChange,
  title,
  htmlContent,
}) => {
  const [downloading, setDownloading] = React.useState(false);
  
  // Use srcDoc for cleaner iframe rendering
  // We still need a ref for any potential future direct manipulation (printing inside iframe)
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await printPDF(htmlContent, title);
      toast({
        title: "Report Exported",
        description: "The report has been generated successfully.",
      });
      // Don't close immediately, let the user stay or close manually
    } catch (error) {
      console.error("Export failed", error);
      toast({
        title: "Export Failed",
        description: "There was an error generating the PDF.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 bg-background/95 backdrop-blur-xl border-white/20">
        <DialogHeader className="p-4 border-b border-border/10 flex flex-row items-center justify-between space-y-0">
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Preview Report
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {title}
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-white/5 relative w-full h-full">
            <iframe 
                ref={iframeRef}
                srcDoc={htmlContent}
                className="w-full h-full bg-white shadow-inner"
                title="Report Preview"
                style={{ border: 'none' }}
                sandbox="allow-same-origin" 
            />
        </div>

        <DialogFooter className="p-4 border-t border-border/10 bg-muted/20">
          <div className="flex w-full gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={downloading}
              className="flex-1 sm:flex-none"
            >
              Close
            </Button>
            <Button 
                onClick={handleDownload} 
                disabled={downloading}
                className="flex-1 sm:flex-none bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-primary/20 transition-all duration-300"
            >
              {downloading ? (
                <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                </>
              ) : (
                <>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportPreviewDialog;
