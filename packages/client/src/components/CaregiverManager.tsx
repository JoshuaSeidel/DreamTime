import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  UserPlus,
  Loader2,
  Check,
  X,
  Shield,
  Eye,
  ToggleLeft,
  ToggleRight,
  Pencil,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/components/ui/toaster';
import {
  getChildren,
  getChild,
  shareChild,
  removeCaregiver,
  toggleCaregiverAccess,
  updateCaregiverTitle,
  updateCaregiverRole,
  searchUsers,
  type Child,
  type CaregiverInfo,
  type UserSearchResult,
} from '@/lib/api';

const TITLE_OPTIONS = ['Dad', 'Mom', 'Grandma', 'Grandpa', 'Babysitter', 'Nanny', 'Au Pair', 'Sleep Coach'];

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin', description: 'Full control' },
  { value: 'CAREGIVER', label: 'Caregiver', description: 'Can track sleep' },
  { value: 'VIEWER', label: 'Viewer', description: 'Read-only' },
] as const;

interface CaregiverRowProps {
  caregiver: CaregiverInfo;
  isAdmin: boolean;
  currentUserId: string;
  onToggleAccess: (userId: string, isActive: boolean) => Promise<void>;
  onUpdateTitle: (userId: string, title: string) => Promise<void>;
  onUpdateRole: (userId: string, role: 'ADMIN' | 'CAREGIVER' | 'VIEWER') => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  isLoading: boolean;
}

function CaregiverRow({
  caregiver,
  isAdmin,
  currentUserId,
  onToggleAccess,
  onUpdateTitle,
  onUpdateRole,
  onRemove,
  isLoading,
}: CaregiverRowProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(caregiver.title || '');
  const [showTitleOptions, setShowTitleOptions] = useState(false);
  const [showRoleOptions, setShowRoleOptions] = useState(false);

  const isCurrentUser = caregiver.userId === currentUserId;
  const isPending = caregiver.status === 'PENDING';

  const handleSaveTitle = async () => {
    if (titleValue !== caregiver.title) {
      await onUpdateTitle(caregiver.userId, titleValue);
    }
    setEditingTitle(false);
  };

  const selectTitle = async (title: string) => {
    setTitleValue(title);
    setShowTitleOptions(false);
    await onUpdateTitle(caregiver.userId, title);
  };

  return (
    <div
      className={cn(
        'p-3 rounded-lg border',
        !caregiver.isActive && 'opacity-60 bg-muted/30',
        isPending && 'border-dashed'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{caregiver.name}</span>
            {isPending && (
              <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-0.5 rounded">
                Pending
              </span>
            )}
            {isCurrentUser && caregiver.role === 'ADMIN' && (
              <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded">
                You
              </span>
            )}
            {!caregiver.isActive && !isPending && !isCurrentUser && (
              <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-0.5 rounded">
                Disabled
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{caregiver.email}</p>

          {/* Title & Role */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Role selector */}
            <div className="relative">
              <button
                onClick={() => isAdmin && !isCurrentUser && setShowRoleOptions(!showRoleOptions)}
                disabled={!isAdmin || isCurrentUser}
                className={cn(
                  'text-xs flex items-center gap-1 px-1.5 py-0.5 rounded',
                  caregiver.role === 'ADMIN' && 'bg-primary/10 text-primary',
                  caregiver.role === 'CAREGIVER' && 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
                  caregiver.role === 'VIEWER' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                  isAdmin && !isCurrentUser && 'hover:ring-1 hover:ring-primary/50 cursor-pointer'
                )}
              >
                {caregiver.role === 'ADMIN' && <Shield className="w-3 h-3" />}
                {caregiver.role === 'VIEWER' && <Eye className="w-3 h-3" />}
                {caregiver.role}
                {isAdmin && !isCurrentUser && (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {showRoleOptions && (
                <div className="absolute top-full left-0 mt-1 bg-popover border rounded-md shadow-lg z-20 p-1 min-w-[140px]">
                  {ROLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={async () => {
                        setShowRoleOptions(false);
                        if (option.value !== caregiver.role) {
                          await onUpdateRole(caregiver.userId, option.value);
                        }
                      }}
                      className={cn(
                        'w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted',
                        option.value === caregiver.role && 'bg-muted'
                      )}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-muted-foreground">{option.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="text-muted-foreground">·</span>

            {/* Title selector */}
            {editingTitle ? (
              <div className="flex items-center gap-1">
                <Input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="h-6 w-24 text-xs"
                  placeholder="Title"
                />
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveTitle}>
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setEditingTitle(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => isAdmin && !isCurrentUser && setShowTitleOptions(!showTitleOptions)}
                  disabled={!isAdmin || isCurrentUser}
                  className={cn(
                    'text-xs text-muted-foreground flex items-center gap-1',
                    isAdmin && !isCurrentUser && 'hover:text-foreground cursor-pointer'
                  )}
                >
                  {caregiver.title || 'Set title'}
                  {isAdmin && !isCurrentUser && (
                    showTitleOptions ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )
                  )}
                </button>

                {showTitleOptions && (
                  <div className="absolute top-full left-0 mt-1 bg-popover border rounded-md shadow-lg z-10 p-1 min-w-[120px]">
                    {TITLE_OPTIONS.map((title) => (
                      <button
                        key={title}
                        onClick={() => selectTitle(title)}
                        className="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted"
                      >
                        {title}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setShowTitleOptions(false);
                        setEditingTitle(true);
                      }}
                      className="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted flex items-center gap-1 border-t mt-1 pt-1"
                    >
                      <Pencil className="w-3 h-3" />
                      Custom...
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {isAdmin && !isCurrentUser && !isPending && (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onToggleAccess(caregiver.userId, !caregiver.isActive)}
              disabled={isLoading}
              title={caregiver.isActive ? 'Disable access' : 'Enable access'}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : caregiver.isActive ? (
                <ToggleRight className="w-4 h-4 text-green-600" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onRemove(caregiver.userId)}
              disabled={isLoading}
              title="Remove caregiver"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CaregiverManager() {
  const { accessToken, user } = useAuthStore();
  const toast = useToast();

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [caregivers, setCaregivers] = useState<CaregiverInfo[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(true);
  const [isLoadingCaregivers, setIsLoadingCaregivers] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [inviteRole, setInviteRole] = useState<'CAREGIVER' | 'VIEWER'>('CAREGIVER');
  const [isSearching, setIsSearching] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Only show children where user is ADMIN
  const adminChildren = children.filter((c) => c.role === 'ADMIN');
  const selectedChild = adminChildren.find((c) => c.id === selectedChildId);

  // Load children
  useEffect(() => {
    async function loadChildren() {
      if (!accessToken) return;

      setIsLoadingChildren(true);
      try {
        const result = await getChildren(accessToken);
        if (result.success && result.data) {
          setChildren(result.data);
          // Auto-select first admin child
          const firstAdmin = result.data.find((c) => c.role === 'ADMIN');
          if (firstAdmin) {
            setSelectedChildId(firstAdmin.id);
          }
        }
      } catch (err) {
        console.error('[CaregiverManager] Failed to load children:', err);
      } finally {
        setIsLoadingChildren(false);
      }
    }
    loadChildren();
  }, [accessToken]);

  // Load caregivers when child selected
  const loadCaregivers = useCallback(async () => {
    if (!accessToken || !selectedChildId) return;

    setIsLoadingCaregivers(true);
    try {
      const result = await getChild(accessToken, selectedChildId);
      if (result.success && result.data) {
        setCaregivers(result.data.caregivers);
      }
    } catch (err) {
      console.error('[CaregiverManager] Failed to load caregivers:', err);
    } finally {
      setIsLoadingCaregivers(false);
    }
  }, [accessToken, selectedChildId]);

  useEffect(() => {
    loadCaregivers();
  }, [loadCaregivers]);

  // Handle user search with debounce
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!searchQuery || searchQuery.length < 2 || !accessToken) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const result = await searchUsers(accessToken, searchQuery);
        if (result.success && result.data) {
          // Filter out users who are already caregivers
          const existingUserIds = new Set(caregivers.map((c) => c.userId));
          const filtered = result.data.filter((u) => !existingUserIds.has(u.id));
          setSearchResults(filtered);
          setShowDropdown(filtered.length > 0);
        }
      } catch (err) {
        console.error('[CaregiverManager] Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, accessToken, caregivers]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setSearchQuery(user.name);
    setShowDropdown(false);
  };

  const handleAddCaregiver = async () => {
    if (!accessToken || !selectedChildId || !selectedUser) return;

    setIsInviting(true);
    try {
      const result = await shareChild(accessToken, selectedChildId, {
        userId: selectedUser.id,
        role: inviteRole,
      });

      if (result.success) {
        toast.success('Caregiver added', `${selectedUser.name} can now access this child`);
        setSearchQuery('');
        setSelectedUser(null);
        setShowInviteForm(false);
        loadCaregivers();
      } else {
        toast.error('Failed to add', result.error?.message || 'Could not add caregiver');
      }
    } catch (err) {
      console.error('[CaregiverManager] Add error:', err);
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsInviting(false);
    }
  };

  const handleToggleAccess = async (caregiverUserId: string, isActive: boolean) => {
    if (!accessToken || !selectedChildId) return;

    setIsActionLoading(true);
    try {
      const result = await toggleCaregiverAccess(accessToken, selectedChildId, caregiverUserId, isActive);
      if (result.success) {
        toast.success(
          isActive ? 'Access enabled' : 'Access disabled',
          isActive ? 'Caregiver can now see this child' : 'Caregiver can no longer see this child'
        );
        loadCaregivers();
      } else {
        toast.error('Action failed', result.error?.message || 'Could not update access');
      }
    } catch (err) {
      console.error('[CaregiverManager] Toggle access error:', err);
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdateTitle = async (caregiverUserId: string, title: string) => {
    if (!accessToken || !selectedChildId) return;

    try {
      const result = await updateCaregiverTitle(accessToken, selectedChildId, caregiverUserId, title);
      if (result.success) {
        toast.success('Title updated', `Changed to "${title}"`);
        loadCaregivers();
      } else {
        toast.error('Update failed', result.error?.message || 'Could not update title');
      }
    } catch (err) {
      console.error('[CaregiverManager] Update title error:', err);
      toast.error('Error', 'An unexpected error occurred');
    }
  };

  const handleRemove = async (caregiverUserId: string) => {
    if (!accessToken || !selectedChildId) return;

    if (!confirm('Remove this caregiver? They will lose all access to this child.')) {
      return;
    }

    setIsActionLoading(true);
    try {
      const result = await removeCaregiver(accessToken, selectedChildId, caregiverUserId);
      if (result.success) {
        toast.success('Caregiver removed', 'Access has been revoked');
        loadCaregivers();
      } else {
        toast.error('Remove failed', result.error?.message || 'Could not remove caregiver');
      }
    } catch (err) {
      console.error('[CaregiverManager] Remove error:', err);
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdateRole = async (caregiverUserId: string, role: 'ADMIN' | 'CAREGIVER' | 'VIEWER') => {
    if (!accessToken || !selectedChildId) return;

    const roleLabel = role === 'ADMIN' ? 'Admin' : role === 'CAREGIVER' ? 'Caregiver' : 'Viewer';

    if (role === 'ADMIN' && !confirm(`Promote this caregiver to Admin? They will have full control over this child's profile and caregivers.`)) {
      return;
    }

    setIsActionLoading(true);
    try {
      const result = await updateCaregiverRole(accessToken, selectedChildId, caregiverUserId, role);
      if (result.success) {
        toast.success('Role updated', `Changed to ${roleLabel}`);
        loadCaregivers();
      } else {
        toast.error('Update failed', result.error?.message || 'Could not update role');
      }
    } catch (err) {
      console.error('[CaregiverManager] Update role error:', err);
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoadingChildren) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (adminChildren.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Caregivers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            You need to be an admin of a child to manage caregivers.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4" />
          Caregivers
        </CardTitle>
        <CardDescription>
          Manage who can access your children's data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Child Selector (if multiple admin children) */}
        {adminChildren.length > 1 && (
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Select Child</label>
            <select
              value={selectedChildId || ''}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="w-full p-2 rounded-md border bg-background"
            >
              {adminChildren.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Single child display */}
        {adminChildren.length === 1 && selectedChild && (
          <div className="text-sm text-muted-foreground">
            Managing caregivers for <span className="font-medium text-foreground">{selectedChild.name}</span>
          </div>
        )}

        {/* Caregivers List */}
        {isLoadingCaregivers ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : caregivers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No caregivers yet. Invite someone to share access.
          </p>
        ) : (
          <div className="space-y-2">
            {caregivers.map((caregiver) => (
              <CaregiverRow
                key={caregiver.id}
                caregiver={caregiver}
                isAdmin={selectedChild?.role === 'ADMIN'}
                currentUserId={user?.id || ''}
                onToggleAccess={handleToggleAccess}
                onUpdateTitle={handleUpdateTitle}
                onUpdateRole={handleUpdateRole}
                onRemove={handleRemove}
                isLoading={isActionLoading}
              />
            ))}
          </div>
        )}

        {/* Add Caregiver Form */}
        {showInviteForm ? (
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <div className="relative" ref={dropdownRef}>
              <label className="text-sm font-medium mb-1 block">Search for user</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedUser(null);
                  }}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  className="pl-9"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Search Results Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-20 max-h-48 overflow-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{user.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && !selectedUser && (
                <p className="text-xs text-muted-foreground mt-1">
                  No users found. They need to create an account first.
                </p>
              )}
            </div>

            {/* Selected User Display */}
            {selectedUser && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{selectedUser.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{selectedUser.email}</div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchQuery('');
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">Role</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setInviteRole('CAREGIVER')}
                  className={cn(
                    'flex-1 p-2 rounded-md border text-sm',
                    inviteRole === 'CAREGIVER'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <Shield className="w-4 h-4 mx-auto mb-1" />
                  Caregiver
                  <p className="text-xs text-muted-foreground">Can track sleep</p>
                </button>
                <button
                  onClick={() => setInviteRole('VIEWER')}
                  className={cn(
                    'flex-1 p-2 rounded-md border text-sm',
                    inviteRole === 'VIEWER'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <Eye className="w-4 h-4 mx-auto mb-1" />
                  Viewer
                  <p className="text-xs text-muted-foreground">Read-only access</p>
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAddCaregiver}
                disabled={!selectedUser || isInviting}
                className="flex-1"
              >
                {isInviting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Caregiver
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => {
                setShowInviteForm(false);
                setSearchQuery('');
                setSelectedUser(null);
              }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowInviteForm(true)}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Caregiver
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
