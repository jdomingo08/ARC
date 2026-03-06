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
import { Plus, Layers, Users, Tag, Trash2, Pencil } from "lucide-react";
import type { PlatformAttributeDefinition, Tier, User } from "@shared/schema";

export default function AdminPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-admin-title">Administration</h1>
        <p className="text-muted-foreground mt-1">Manage attributes, tiers, and user roles</p>
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
