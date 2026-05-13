import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Mail, 
  User, 
  MessageSquare, 
  Send, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  ArrowLeft 
} from 'lucide-react';
import Navbar from '../../Components/UI/Navbar';

const ContactAdmin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      alert('Message sent successfully! We will get back to you soon.');
      navigate('/signin');
    }, 1500);
  };

  return (
    <div className="flex-1 bg-background flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center p-4 bg-slate-50/50 dark:bg-background">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Main Form Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-border bg-primary/[0.02] flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Contact Admin</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">Send a message directly to the system administrators</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Username */}
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                    <User className="w-3.5 h-3.5" />
                    Username
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. john.doe"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm placeholder:text-muted-foreground/50"
                    required
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                    <Mail className="w-3.5 h-3.5" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="you@university.edu"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm placeholder:text-muted-foreground/50"
                    required
                  />
                </div>

                {/* Message */}
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Message
                  </label>
                  <div className="relative">
                    <textarea
                      placeholder="Describe your issue or inquiry in detail..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      maxLength={1000}
                      className="w-full h-32 p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm placeholder:text-muted-foreground/50 resize-none"
                      required
                    />
                    <div className="absolute bottom-3 right-3 text-[10px] font-medium text-muted-foreground bg-background/80 px-2 py-1 rounded-md border border-border/50">
                      {formData.message.length}/1000
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Typical response time:</span>
                    <span className="font-bold text-foreground">within 24 hours</span>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto h-10 px-6 bg-primary text-primary-foreground font-bold rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </form>
            </div>
            
            <button 
              onClick={() => navigate('/signin')}
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors ml-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </button>
          </div>

          {/* Side Information Cards */}
          <div className="space-y-4">
            {/* Features Card */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Secure Channel</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Your message is encrypted and routed only to authorized administrators.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Fast Response</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Most inquiries are answered within one business day.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Tracked Tickets</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Every submission gets a reference ID for follow-up.
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Contact Card */}
            <div className="bg-primary/5 rounded-2xl border border-primary/10 p-6 space-y-3 shadow-sm">
              <div className="space-y-0.5">
                <p className="text-[9px] font-bold text-primary uppercase tracking-widest">Direct Contact</p>
                <p className="text-base font-bold text-foreground truncate">admin@university.edu</p>
                <p className="text-xs text-muted-foreground font-medium">Mon – Fri, 8:00 AM – 5:00 PM</p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default ContactAdmin;
