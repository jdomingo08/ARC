import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/status-badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Layers, Users, Tag, Trash2, Pencil, Bell, Save, GitBranch, ArrowUp, ArrowDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { PlatformAttributeDefinition, Tier, User, AlertSchedule, WorkflowStep } from "@shared/schema";

export default function AdminPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-admin-title">Administration</h1>
        <p className="text-muted-foreground mt-1">Manage attributes, tiers, user roles, alert schedules, and workflow</p>
      </div>

      <Tabs defaultValue="attributes">
        <TabsList>
          <TabsTrigger value="attributes" data-testid="tab-attributes">
            <Tag className="h-4 w-4 mr-1" /> Attributes
          </TabsTrigger>
          <TabsTrigger value="tiers" data-testid="tab-tiers">
            <Layers className="h-4 w-4 mr-1" /> Tiers
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-1" /> Users
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            <Bell className="h-4 w-4 mr-1" /> Alerts
          </TabsTrigger>
          <TabsTrigger value="workflow" data-testid="tab-workflow">
            <GitBranch className="h-4 w-4 mr-1" /> Workflow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attributes" className="mt-4">
          <AttributesTab />
        </TabsContent>
        <TabsContent value="tiers" className="mt-4">
          <TiersTab />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <AlertsTab />
        </TabsContent>
        <TabsContent value="workflow" className="mt-4">
          <WorkflowTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AttributesTab() {
  const { toast } = useToast();
  const { data: attributes, isLoading } = useQuery<PlatformAttributeDefinition[]>({
    queryKey: ["/api/admin/attributes"],
  });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState("text");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState("");
  const [defaultValue, setDefaultValue] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { name, dataType, required, defaultValue: defaultValue || null };
      if (dataType === "dropdown" || dataType === "multi_select") {
        payload.options = options.split(",").map(o => o.trim()).filter(Boolean);
      }
      const res = await apiRequest("POST", "/api/admin/attributes", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Attribute Created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/attributes"] });
      setOpen(false);
      setName("");
      setDataType("text");
      setRequired(false);
      setOptions("");
      setDefaultValue("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/attributes/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Attribute Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/attributes"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleDelete = (id: string, attrName: string) => {
    if (window.confirm(`Delete attribute "${attrName}"? This cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-1">
        <div>
          <CardTitle>Custom Attributes</CardTitle>
          <CardDescription>Define additional attributes for platform records</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-attribute">
              <Plus className="h-4 w-4 mr-1" /> Add Attribute
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Attribute Definition</DialogTitle>
              <DialogDescription>Create a new platform attribute that will appear on all platform records</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Contract Expiration" data-testid="input-attr-name" />
              </div>
              <div className="space-y-2">
                <Label>Data Type *</Label>
                <Select value={dataType} onValueChange={setDataType}>
                  <SelectTrigger data-testid="select-attr-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="dropdown">Dropdown</SelectItem>
                    <SelectItem value="multi_select">Multi-Select</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(dataType === "dropdown" || dataType === "multi_select") && (
                <div className="space-y-2">
                  <Label>Options (comma-separated)</Label>
                  <Input value={options} onChange={e => setOptions(e.target.value)} placeholder="Option 1, Option 2, Option 3" data-testid="input-attr-options" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Default Value</Label>
                <Input value={defaultValue} onChange={e => setDefaultValue(e.target.value)} data-testid="input-attr-default" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={required} onCheckedChange={v => setRequired(!!v)} id="attr-req" data-testid="checkbox-attr-required" />
                <Label htmlFor="attr-req">Required</Label>
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending} className="w-full" data-testid="button-save-attribute">
                {createMutation.isPending ? "Creating..." : "Create Attribute"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {attributes && attributes.length > 0 ? (
          <div className="space-y-2">
            {attributes.map(attr => (
              <div key={attr.id} className="flex items-center justify-between gap-2 p-3 rounded-md border">
                <div>
                  <p className="font-medium text-sm">{attr.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {attr.dataType} {attr.required ? "- Required" : "- Optional"}
                    {attr.defaultValue ? ` - Default: ${attr.defaultValue}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{attr.dataType}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(attr.id, attr.name)}
                    data-testid={`button-delete-attr-${attr.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No custom attributes defined yet</p>
        )}
      </CardContent>
    </Card>
  );
}

function TiersTab() {
  const { toast } = useToast();
  const { data: tiersList, isLoading } = useQuery<Tier[]>({ queryKey: ["/api/admin/tiers"] });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [requiredControls, setRequiredControls] = useState("");
  const [allowedDataTypes, setAllowedDataTypes] = useState("");

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRequiredControls, setEditRequiredControls] = useState("");
  const [editAllowedDataTypes, setEditAllowedDataTypes] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { name, description };
      if (requiredControls.trim()) {
        payload.requiredControls = requiredControls.split(",").map(c => c.trim()).filter(Boolean);
      }
      if (allowedDataTypes.trim()) {
        payload.allowedDataTypes = allowedDataTypes.split(",").map(d => d.trim()).filter(Boolean);
      }
      const res = await apiRequest("POST", "/api/admin/tiers", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Tier Created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tiers"] });
      setOpen(false);
      setName("");
      setDescription("");
      setRequiredControls("");
      setAllowedDataTypes("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { name: editName, description: editDescription };
      payload.requiredControls = editRequiredControls.trim()
        ? editRequiredControls.split(",").map(c => c.trim()).filter(Boolean)
        : [];
      payload.allowedDataTypes = editAllowedDataTypes.trim()
        ? editAllowedDataTypes.split(",").map(d => d.trim()).filter(Boolean)
        : [];
      const res = await apiRequest("PATCH", `/api/admin/tiers/${editId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Tier Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tiers"] });
      setEditOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/tiers/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Tier Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tiers"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openEdit = (tier: Tier) => {
    setEditId(tier.id);
    setEditName(tier.name);
    setEditDescription(tier.description || "");
    setEditRequiredControls(
      tier.requiredControls && Array.isArray(tier.requiredControls)
        ? (tier.requiredControls as string[]).join(", ")
        : ""
    );
    setEditAllowedDataTypes(
      tier.allowedDataTypes && Array.isArray(tier.allowedDataTypes)
        ? (tier.allowedDataTypes as string[]).join(", ")
        : ""
    );
    setEditOpen(true);
  };

  const handleDelete = (id: string, tierName: string) => {
    if (window.confirm(`Delete tier "${tierName}"? Platforms assigned to this tier will lose their tier assignment.`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-1">
        <div>
          <CardTitle>Platform Tiers</CardTitle>
          <CardDescription>Define tiers for categorizing approved platforms. Add as many tiers as needed.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-tier">
              <Plus className="h-4 w-4 mr-1" /> Add Tier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Tier</DialogTitle>
              <DialogDescription>Define a new platform classification tier. You can create unlimited tiers to match your governance needs.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Tier 3 - Restricted" data-testid="input-tier-name" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the tier requirements and policies" data-testid="input-tier-desc" />
              </div>
              <div className="space-y-2">
                <Label>Required Controls (comma-separated)</Label>
                <Input value={requiredControls} onChange={e => setRequiredControls(e.target.value)} placeholder="e.g., SSO, MFA, Data Encryption, DLP" data-testid="input-tier-controls" />
              </div>
              <div className="space-y-2">
                <Label>Allowed Data Types (comma-separated)</Label>
                <Input value={allowedDataTypes} onChange={e => setAllowedDataTypes(e.target.value)} placeholder="e.g., Public, Internal, PII, Client Data" data-testid="input-tier-data-types" />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending} className="w-full" data-testid="button-save-tier">
                {createMutation.isPending ? "Creating..." : "Create Tier"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {tiersList && tiersList.length > 0 ? (
          <div className="space-y-2">
            {tiersList.map(tier => (
              <div key={tier.id} className="p-3 rounded-md border">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{tier.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{tier.description || "No description"}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={() => openEdit(tier)}
                      data-testid={`button-edit-tier-${tier.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(tier.id, tier.name)}
                      data-testid={`button-delete-tier-${tier.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {tier.requiredControls && Array.isArray(tier.requiredControls) && (tier.requiredControls as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-xs text-muted-foreground mr-1">Controls:</span>
                    {(tier.requiredControls as string[]).map((c, i) => <Badge key={i} variant="outline">{c}</Badge>)}
                  </div>
                )}
                {tier.allowedDataTypes && Array.isArray(tier.allowedDataTypes) && (tier.allowedDataTypes as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-xs text-muted-foreground mr-1">Data Types:</span>
                    {(tier.allowedDataTypes as string[]).map((d, i) => <Badge key={i} variant="secondary">{d}</Badge>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No tiers defined yet. Click "Add Tier" to create your first tier.</p>
        )}
      </CardContent>

      {/* Edit Tier Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tier</DialogTitle>
            <DialogDescription>Update the tier configuration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} data-testid="input-edit-tier-name" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} data-testid="input-edit-tier-desc" />
            </div>
            <div className="space-y-2">
              <Label>Required Controls (comma-separated)</Label>
              <Input value={editRequiredControls} onChange={e => setEditRequiredControls(e.target.value)} data-testid="input-edit-tier-controls" />
            </div>
            <div className="space-y-2">
              <Label>Allowed Data Types (comma-separated)</Label>
              <Input value={editAllowedDataTypes} onChange={e => setEditAllowedDataTypes(e.target.value)} data-testid="input-edit-tier-data-types" />
            </div>
            <Button onClick={() => updateMutation.mutate()} disabled={!editName || updateMutation.isPending} className="w-full" data-testid="button-update-tier">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function UsersTab() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { data: usersList, isLoading } = useQuery<User[]>({ queryKey: ["/api/admin/users"] });

  // Add user state
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newRole, setNewRole] = useState("requester");

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role, reviewerRole }: { id: string; role: string; reviewerRole?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/role`, { role, reviewerRole });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Role Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/users", {
        name: newName,
        email: newEmail,
        department: newDepartment || null,
        role: newRole,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User Added" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setAddOpen(false);
      setNewName("");
      setNewEmail("");
      setNewDepartment("");
      setNewRole("requester");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleDelete = (id: string, userName: string) => {
    if (window.confirm(`Delete user "${userName}"? This cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-1">
        <div>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage user roles and permissions</CardDescription>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-user">
              <Plus className="h-4 w-4 mr-1" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add User</DialogTitle>
              <DialogDescription>Create a new user account.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" data-testid="input-user-name" />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@company.com" data-testid="input-user-email" />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={newDepartment} onChange={e => setNewDepartment(e.target.value)} placeholder="e.g., Engineering" data-testid="input-user-dept" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requester">Requester</SelectItem>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="chair">Chair</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createUserMutation.mutate()} disabled={!newName || !newEmail || createUserMutation.isPending} className="w-full" data-testid="button-save-user">
                {createUserMutation.isPending ? "Adding..." : "Add User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {usersList?.map(u => (
            <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-md border">
              <div className="min-w-0">
                <p className="font-medium text-sm">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email} - {u.department}</p>
              </div>
              <div className="flex items-center gap-2">
                {u.reviewerRole && <RoleBadge role={u.reviewerRole} />}
                <Select value={u.role} onValueChange={v => updateRoleMutation.mutate({ id: u.id, role: v })}>
                  <SelectTrigger className="w-[130px]" data-testid={`select-role-${u.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requester">Requester</SelectItem>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="chair">Chair</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {currentUser?.id !== u.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(u.id, u.name)}
                    data-testid={`button-delete-user-${u.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const REVIEWER_ROLE_OPTIONS = ["security", "technical_financial", "chair", "strategic"];

function WorkflowTab() {
  const { toast } = useToast();
  const { data: steps, isLoading } = useQuery<WorkflowStep[]>({
    queryKey: ["/api/admin/workflow-steps"],
  });
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newReviewerRole, setNewReviewerRole] = useState("security");
  const [newCustomRole, setNewCustomRole] = useState("");
  const [useCustomRole, setUseCustomRole] = useState(false);
  const [newRequired, setNewRequired] = useState(true);
  const [newMinApprovals, setNewMinApprovals] = useState(1);

  const sortedSteps = steps ? [...steps].sort((a, b) => a.sortOrder - b.sortOrder) : [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const role = useCustomRole ? newCustomRole : newReviewerRole;
      const sortOrder = sortedSteps.length > 0 ? sortedSteps[sortedSteps.length - 1].sortOrder + 1 : 1;
      const res = await apiRequest("POST", "/api/admin/workflow-steps", {
        name: newName,
        reviewerRole: role,
        sortOrder,
        required: newRequired,
        minApprovals: newMinApprovals,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Workflow Step Created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflow-steps"] });
      setOpen(false);
      setNewName("");
      setNewReviewerRole("security");
      setNewCustomRole("");
      setUseCustomRole(false);
      setNewRequired(true);
      setNewMinApprovals(1);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, sortOrder }: { id: string; sortOrder: number }) => {
      const res = await apiRequest("PATCH", `/api/admin/workflow-steps/${id}`, { sortOrder });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflow-steps"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleRequiredMutation = useMutation({
    mutationFn: async ({ id, required }: { id: string; required: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/workflow-steps/${id}`, { required });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Step Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflow-steps"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMinApprovalsMutation = useMutation({
    mutationFn: async ({ id, minApprovals }: { id: string; minApprovals: number }) => {
      const res = await apiRequest("PATCH", `/api/admin/workflow-steps/${id}`, { minApprovals });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Min Approvals Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflow-steps"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/workflow-steps/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Workflow Step Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/workflow-steps"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleDelete = (id: string, stepName: string) => {
    if (window.confirm(`Delete workflow step "${stepName}"? This cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const current = sortedSteps[index];
    const above = sortedSteps[index - 1];
    reorderMutation.mutate({ id: current.id, sortOrder: above.sortOrder });
    reorderMutation.mutate({ id: above.id, sortOrder: current.sortOrder });
  };

  const handleMoveDown = (index: number) => {
    if (index >= sortedSteps.length - 1) return;
    const current = sortedSteps[index];
    const below = sortedSteps[index + 1];
    reorderMutation.mutate({ id: current.id, sortOrder: below.sortOrder });
    reorderMutation.mutate({ id: below.id, sortOrder: current.sortOrder });
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-1">
        <div>
          <CardTitle>Workflow Steps</CardTitle>
          <CardDescription>Configure the review workflow steps and their order</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-workflow-step">
              <Plus className="h-4 w-4 mr-1" /> Add Step
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Workflow Step</DialogTitle>
              <DialogDescription>Add a new step to the review workflow</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., Security Review" data-testid="input-step-name" />
              </div>
              <div className="space-y-2">
                <Label>Reviewer Role *</Label>
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox checked={useCustomRole} onCheckedChange={v => setUseCustomRole(!!v)} id="use-custom-role" data-testid="checkbox-custom-role" />
                  <Label htmlFor="use-custom-role" className="text-sm">Use custom role</Label>
                </div>
                {useCustomRole ? (
                  <Input value={newCustomRole} onChange={e => setNewCustomRole(e.target.value)} placeholder="Enter custom role name" data-testid="input-custom-role" />
                ) : (
                  <Select value={newReviewerRole} onValueChange={setNewReviewerRole}>
                    <SelectTrigger data-testid="select-reviewer-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REVIEWER_ROLE_OPTIONS.map(role => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={newRequired} onCheckedChange={setNewRequired} id="new-step-required" data-testid="switch-step-required" />
                <Label htmlFor="new-step-required">Required</Label>
              </div>
              <div className="space-y-2">
                <Label>Min Approvals</Label>
                <Input type="number" min={1} value={newMinApprovals} onChange={e => setNewMinApprovals(parseInt(e.target.value) || 1)} data-testid="input-step-min-approvals" />
              </div>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newName || (useCustomRole ? !newCustomRole : false) || createMutation.isPending}
                className="w-full"
                data-testid="button-save-workflow-step"
              >
                {createMutation.isPending ? "Creating..." : "Create Step"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {sortedSteps.length > 0 ? (
          <div className="space-y-2">
            {sortedSteps.map((step, index) => (
              <div key={step.id} className="flex items-center justify-between gap-3 p-3 rounded-md border">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      disabled={index === 0 || reorderMutation.isPending}
                      onClick={() => handleMoveUp(index)}
                      data-testid={`button-move-up-${step.id}`}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      disabled={index === sortedSteps.length - 1 || reorderMutation.isPending}
                      onClick={() => handleMoveDown(index)}
                      data-testid={`button-move-down-${step.id}`}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{step.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Role: {step.reviewerRole} | Order: {step.sortOrder}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={step.required}
                      onCheckedChange={checked => toggleRequiredMutation.mutate({ id: step.id, required: checked })}
                      data-testid={`switch-required-${step.id}`}
                    />
                    <Label className="text-xs">{step.required ? "Required" : "Optional"}</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs whitespace-nowrap">Min approvals</Label>
                    <Input
                      type="number"
                      min={1}
                      className="w-16 h-7 text-xs"
                      value={step.minApprovals}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        if (val >= 1) updateMinApprovalsMutation.mutate({ id: step.id, minApprovals: val });
                      }}
                      data-testid={`input-min-approvals-${step.id}`}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(step.id, step.name)}
                    data-testid={`button-delete-step-${step.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No workflow steps defined yet. Click "Add Step" to create your first step.</p>
        )}
      </CardContent>
    </Card>
  );
}

const ALERT_FREQUENCY_PRESETS = [
  { label: "Daily (8 AM)", cron: "0 8 * * *" },
  { label: "Daily (midnight)", cron: "0 0 * * *" },
  { label: "Weekly (Monday)", cron: "0 8 * * 1" },
  { label: "Every 6 hours", cron: "0 */6 * * *" },
];

function AlertsTab() {
  const { toast } = useToast();
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean | null>(null);
  const [scheduleCron, setScheduleCron] = useState<string>("");
  const [scheduleModified, setScheduleModified] = useState(false);

  const { data: schedule } = useQuery<AlertSchedule>({
    queryKey: ["/api/alerts/schedule"],
    select: (data) => {
      if (scheduleEnabled === null && data) {
        setScheduleEnabled(data.enabled);
        setScheduleCron(data.cronExpression);
      }
      return data;
    },
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/alerts/schedule", {
        enabled: scheduleEnabled,
        cronExpression: scheduleCron,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Alert Schedule Updated", description: "Expiration alert schedule has been saved." });
      setScheduleModified(false);
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/schedule"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-4 w-4" /> Expiration Alert Schedule
        </CardTitle>
        <CardDescription>Configure automatic contract expiration alert checking</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          When enabled, the system automatically checks all platforms for upcoming contract expirations
          and triggers alerts on the configured schedule.
        </p>
        <div className="flex items-center gap-3">
          <Switch
            checked={scheduleEnabled ?? false}
            onCheckedChange={(checked) => {
              setScheduleEnabled(checked);
              setScheduleModified(true);
            }}
            id="alert-schedule-enabled"
          />
          <Label htmlFor="alert-schedule-enabled">Enable automatic alert checking</Label>
        </div>
        {scheduleEnabled && (
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={scheduleCron}
              onValueChange={(value) => {
                setScheduleCron(value);
                setScheduleModified(true);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {ALERT_FREQUENCY_PRESETS.map(preset => (
                  <SelectItem key={preset.cron} value={preset.cron}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Cron: <code className="px-1 py-0.5 bg-muted rounded text-[11px]">{scheduleCron}</code>
            </p>
          </div>
        )}
        {schedule?.lastRunAt && (
          <p className="text-xs text-muted-foreground">Last run: {formatDate(schedule.lastRunAt)}</p>
        )}
        {scheduleModified && (
          <Button
            size="sm"
            onClick={() => saveScheduleMutation.mutate()}
            disabled={saveScheduleMutation.isPending}
          >
            {saveScheduleMutation.isPending ? "Saving..." : <><Save className="h-3 w-3 mr-1" /> Save Schedule</>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
