import { useState, useEffect, useCallback } from 'react';
import { Moon, Sun, Clock, ChevronRight, Calendar, Loader2, X, AlertTriangle, Pencil, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getSessions, updateSession, type SleepSession } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/components/ui/toaster';

export default function History() {
  const { accessToken } = useAuthStore();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SleepSession | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Get child ID from localStorage
  useEffect(() => {
    const storedChildId = localStorage.getItem('selectedChildId');
    if (storedChildId) {
      setSelectedChildId(storedChildId);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    if (!accessToken || !selectedChildId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await getSessions(accessToken, selectedChildId);
      if (result.success && result.data) {
        setSessions(result.data.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedChildId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadSessions();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadSessions]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Format time using session's stored timezone (for historical accuracy)
  // Falls back to device timezone if session has no stored timezone
  const formatTime = (dateString: string | null, sessionTimezone?: string | null) => {
    if (!dateString) return '--:--';
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
    };
    if (sessionTimezone) {
      options.timeZone = sessionTimezone;
    }
    return new Date(dateString).toLocaleTimeString([], options);
  };

  // Format date/time using session's stored timezone (for historical accuracy)
  const formatDateTime = (dateString: string | null, sessionTimezone?: string | null) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    if (sessionTimezone) {
      options.timeZone = sessionTimezone;
    }
    return date.toLocaleString([], options);
  };

  const formatDateTimeForInput = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Format as local datetime-local input value
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  };

  const formatDuration = (minutes: number | null | undefined) => {
    if (minutes === null || minutes === undefined || minutes <= 0) return '--';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const isDurationUnrealistic = (minutes: number | null | undefined, type: 'settling' | 'sleep' | 'postWake' | 'total') => {
    if (minutes === null || minutes === undefined) return false;
    switch (type) {
      case 'settling':
        return minutes > 120; // More than 2 hours to settle
      case 'sleep':
        return minutes > 840; // More than 14 hours sleep
      case 'postWake':
        return minutes > 120; // More than 2 hours post-wake
      case 'total':
        return minutes > 900; // More than 15 hours total
      default:
        return false;
    }
  };

  const getSessionIcon = (type: string) => {
    return type === 'NIGHT_SLEEP' ? Moon : Sun;
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'ASLEEP':
        return <Badge variant="default">Asleep</Badge>;
      case 'AWAKE':
        return <Badge variant="warning">Awake</Badge>;
      default:
        return <Badge variant="secondary">In Crib</Badge>;
    }
  };

  const handleSessionClick = (session: SleepSession) => {
    setSelectedSession(session);
    setEditingField(null);
    setEditingNotes(false);
    setNotesValue(session.notes || '');
  };

  const startEdit = (field: string, currentValue: string | null) => {
    setEditingField(field);
    setEditValue(formatDateTimeForInput(currentValue));
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!selectedSession || !editingField || !accessToken || !selectedChildId) return;

    const newDate = new Date(editValue);
    if (isNaN(newDate.getTime())) {
      toast.error('Invalid date', 'Please enter a valid date and time');
      return;
    }

    // Validate the new date makes sense
    const session = selectedSession;
    const putDown = session.putDownAt ? new Date(session.putDownAt) : null;
    const asleep = editingField === 'asleepAt' ? newDate : (session.asleepAt ? new Date(session.asleepAt) : null);
    const wokeUp = editingField === 'wokeUpAt' ? newDate : (session.wokeUpAt ? new Date(session.wokeUpAt) : null);
    const outOfCrib = editingField === 'outOfCribAt' ? newDate : (session.outOfCribAt ? new Date(session.outOfCribAt) : null);
    const newPutDown = editingField === 'putDownAt' ? newDate : putDown;

    // Check chronological order
    if (newPutDown && asleep && asleep < newPutDown) {
      toast.error('Invalid time', 'Fell asleep time cannot be before put down time');
      return;
    }
    if (asleep && wokeUp && wokeUp < asleep) {
      toast.error('Invalid time', 'Woke up time cannot be before fell asleep time');
      return;
    }
    if (wokeUp && outOfCrib && outOfCrib < wokeUp) {
      toast.error('Invalid time', 'Out of crib time cannot be before woke up time');
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateSession(accessToken, selectedChildId, selectedSession.id, {
        [editingField]: newDate.toISOString(),
      });

      if (result.success && result.data) {
        // Update local state
        setSelectedSession(result.data);
        setSessions(prev => prev.map(s => s.id === result.data!.id ? result.data! : s));
        toast.success('Updated', 'Session time updated successfully');
        setEditingField(null);
      } else {
        toast.error('Failed to update', result.error?.message || 'Please try again');
      }
    } catch (err) {
      console.error('Failed to save:', err);
      toast.error('Error', 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const saveNotes = async () => {
    if (!selectedSession || !accessToken || !selectedChildId) return;

    setIsSaving(true);
    try {
      const result = await updateSession(accessToken, selectedChildId, selectedSession.id, {
        notes: notesValue.trim() || undefined,
      });

      if (result.success && result.data) {
        setSelectedSession(result.data);
        setSessions(prev => prev.map(s => s.id === result.data!.id ? result.data! : s));
        toast.success('Notes saved', 'Session notes updated');
        setEditingNotes(false);
      } else {
        toast.error('Failed to save', result.error?.message || 'Please try again');
      }
    } catch (err) {
      console.error('Failed to save notes:', err);
      toast.error('Error', 'Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4">
          <h1 className="text-xl font-bold">Sleep History</h1>
        </header>
        <main className="px-4 py-6 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold">Sleep History</h1>
        <p className="text-sm text-muted-foreground">View past sleep sessions</p>
      </header>

      <main className="px-4 py-6 space-y-4">
        {!selectedChildId ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="rounded-full bg-muted p-4 mx-auto w-fit mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No child selected</p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Select a child from the home screen to view their history
              </p>
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="rounded-full bg-muted p-4 mx-auto w-fit mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No sleep sessions recorded yet</p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Start tracking from the home screen
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {sessions.map((session) => {
              const Icon = getSessionIcon(session.sessionType);
              const sessionDate = formatDate(session.putDownAt || session.createdAt);
              return (
                <Card
                  key={session.id}
                  className="hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => handleSessionClick(session)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'rounded-full p-2',
                            session.sessionType === 'NIGHT_SLEEP'
                              ? 'bg-violet-500/20'
                              : 'bg-yellow-500/20'
                          )}
                        >
                          <Icon
                            className={cn(
                              'w-5 h-5',
                              session.sessionType === 'NIGHT_SLEEP'
                                ? 'text-violet-500'
                                : 'text-yellow-500'
                            )}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {session.sessionType === 'NIGHT_SLEEP'
                                ? 'Night Sleep'
                                : `Nap${session.napNumber ? ` ${session.napNumber}` : ''}`}
                            </span>
                            {getStateBadge(session.state)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Calendar className="w-3 h-3" />
                            <span className="font-medium">{sessionDate}</span>
                            <Clock className="w-3 h-3 ml-1" />
                            <span>
                              {formatTime(session.putDownAt, session.timezone)}
                              {session.outOfCribAt && ` - ${formatTime(session.outOfCribAt, session.timezone)}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {session.sleepMinutes && session.sleepMinutes > 0 && (
                          <div className="text-right">
                            <p className="font-semibold text-primary">
                              {formatDuration(session.sleepMinutes)}
                            </p>
                            <p className="text-xs text-muted-foreground">slept</p>
                          </div>
                        )}
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}
      </main>

      {/* Session Details Dialog - positioned at top */}
      {selectedSession && (
        <div
          className="fixed inset-0 z-50 bg-black/50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSession(null);
          }}
        >
          <div className="min-h-full flex items-start justify-center p-4 pt-16 pb-20">
            <Card className="w-full max-w-md animate-in slide-in-from-top-4 duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2">
                  {selectedSession.sessionType === 'NIGHT_SLEEP' ? (
                    <Moon className="w-5 h-5 text-violet-500" />
                  ) : (
                    <Sun className="w-5 h-5 text-yellow-500" />
                  )}
                  {selectedSession.sessionType === 'NIGHT_SLEEP'
                    ? 'Night Sleep'
                    : `Nap ${selectedSession.napNumber || ''}`}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedSession(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  {getStateBadge(selectedSession.state)}
                </div>

                {/* Date */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{formatDate(selectedSession.putDownAt || selectedSession.createdAt)}</span>
                </div>

                {/* Timestamps - Editable */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm text-muted-foreground">Timeline</h4>
                    <span className="text-xs text-muted-foreground">Tap pencil to edit</span>
                  </div>

                  {/* Put Down */}
                  {selectedSession.putDownAt && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Put Down</span>
                      {editingField === 'putDownAt' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="datetime-local"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-48 h-8 text-sm"
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit} disabled={isSaving}>
                            <Check className="w-4 h-4 text-green-500" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{formatDateTime(selectedSession.putDownAt, selectedSession.timezone)}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit('putDownAt', selectedSession.putDownAt)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fell Asleep */}
                  {selectedSession.asleepAt && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Fell Asleep</span>
                      {editingField === 'asleepAt' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="datetime-local"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-48 h-8 text-sm"
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit} disabled={isSaving}>
                            <Check className="w-4 h-4 text-green-500" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{formatDateTime(selectedSession.asleepAt, selectedSession.timezone)}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit('asleepAt', selectedSession.asleepAt)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Woke Up */}
                  {selectedSession.wokeUpAt && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Woke Up</span>
                      {editingField === 'wokeUpAt' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="datetime-local"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-48 h-8 text-sm"
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit} disabled={isSaving}>
                            <Check className="w-4 h-4 text-green-500" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{formatDateTime(selectedSession.wokeUpAt, selectedSession.timezone)}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit('wokeUpAt', selectedSession.wokeUpAt)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Out of Crib */}
                  {selectedSession.outOfCribAt && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Out of Crib</span>
                      {editingField === 'outOfCribAt' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="datetime-local"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-48 h-8 text-sm"
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit} disabled={isSaving}>
                            <Check className="w-4 h-4 text-green-500" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{formatDateTime(selectedSession.outOfCribAt, selectedSession.timezone)}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit('outOfCribAt', selectedSession.outOfCribAt)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Durations with warnings */}
                <div className="space-y-2 border-t pt-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Durations</h4>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Crib Time</span>
                    <div className="flex items-center gap-2">
                      {isDurationUnrealistic(selectedSession.totalMinutes, 'total') && (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      )}
                      <span className={cn(
                        "font-medium",
                        isDurationUnrealistic(selectedSession.totalMinutes, 'total') && "text-yellow-500"
                      )}>
                        {formatDuration(selectedSession.totalMinutes)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Actual Sleep</span>
                    <div className="flex items-center gap-2">
                      {isDurationUnrealistic(selectedSession.sleepMinutes, 'sleep') && (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      )}
                      <span className={cn(
                        "font-medium text-primary",
                        isDurationUnrealistic(selectedSession.sleepMinutes, 'sleep') && "text-yellow-500"
                      )}>
                        {formatDuration(selectedSession.sleepMinutes)}
                      </span>
                    </div>
                  </div>

                  {selectedSession.settlingMinutes !== null && selectedSession.settlingMinutes !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Settling Time</span>
                      <div className="flex items-center gap-2">
                        {isDurationUnrealistic(selectedSession.settlingMinutes, 'settling') && (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className={cn(
                          isDurationUnrealistic(selectedSession.settlingMinutes, 'settling') && "text-yellow-500"
                        )}>
                          {formatDuration(selectedSession.settlingMinutes)}
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedSession.postWakeMinutes !== null && selectedSession.postWakeMinutes !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Post-Wake Time</span>
                      <div className="flex items-center gap-2">
                        {isDurationUnrealistic(selectedSession.postWakeMinutes, 'postWake') && (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className={cn(
                          isDurationUnrealistic(selectedSession.postWakeMinutes, 'postWake') && "text-yellow-500"
                        )}>
                          {formatDuration(selectedSession.postWakeMinutes)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Warning message for unrealistic values */}
                  {(isDurationUnrealistic(selectedSession.settlingMinutes, 'settling') ||
                    isDurationUnrealistic(selectedSession.sleepMinutes, 'sleep') ||
                    isDurationUnrealistic(selectedSession.totalMinutes, 'total') ||
                    isDurationUnrealistic(selectedSession.postWakeMinutes, 'postWake')) && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg mt-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        Some durations look unusual. This may indicate incorrect timestamps.
                        Tap the pencil icon above to correct any mistakes.
                      </p>
                    </div>
                  )}
                </div>

                {/* Notes - always show, editable */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm text-muted-foreground">Notes</h4>
                    {!editingNotes && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => setEditingNotes(true)}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        {selectedSession.notes ? 'Edit' : 'Add'}
                      </Button>
                    )}
                  </div>
                  {editingNotes ? (
                    <div className="space-y-2">
                      <Textarea
                        value={notesValue}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotesValue(e.target.value)}
                        placeholder="Add notes about this sleep session..."
                        className="min-h-[80px] text-sm"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingNotes(false);
                            setNotesValue(selectedSession.notes || '');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={saveNotes}
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {selectedSession.notes || 'No notes added'}
                    </p>
                  )}
                </div>

                {/* Logged By info */}
                {(selectedSession.createdByName || selectedSession.lastUpdatedByName) && (
                  <div className="space-y-1 border-t pt-4 text-xs text-muted-foreground">
                    {selectedSession.createdByName && (
                      <p>Logged by {selectedSession.createdByName}</p>
                    )}
                    {selectedSession.lastUpdatedByName &&
                     selectedSession.lastUpdatedByUserId !== selectedSession.createdByUserId && (
                      <p>Last updated by {selectedSession.lastUpdatedByName}</p>
                    )}
                  </div>
                )}

                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={() => setSelectedSession(null)}
                >
                  Close
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
