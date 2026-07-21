"use client";

import { Badge, Button, Card, FormField, Modal, pickBilingual } from "@dho/ui";
import type { MemberSummary, UserRole } from "@dho/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  ApiError,
  adminCreateMember,
  adminListMembers,
  adminSetMemberStatus,
  adminUpdateMember,
} from "../../../../lib/auth/api-client";
import { useAuth } from "../../../../lib/auth/auth-context";
import { useDictionary, useLocale } from "../../../../lib/i18n/use-locale";

interface MemberFormState {
  email: string;
  fullName: string;
  qualificationBg: string;
  qualificationEn: string;
  role: UserRole;
  temporaryPassword: string;
}

const EMPTY_FORM: MemberFormState = {
  email: "",
  fullName: "",
  qualificationBg: "",
  qualificationEn: "",
  role: "MEMBER",
  temporaryPassword: "",
};

export default function MembersPage() {
  const { user, accessToken } = useAuth();
  const dictionary = useDictionary();
  const locale = useLocale();
  const router = useRouter();

  const [members, setMembers] = useState<MemberSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<MemberFormState>(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createEmailError, setCreateEmailError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<MemberSummary | null>(null);
  const [editForm, setEditForm] = useState<MemberFormState>(EMPTY_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [editEmailError, setEditEmailError] = useState<string | null>(null);

  const [confirmingDeactivate, setConfirmingDeactivate] = useState<MemberSummary | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      router.push("/admin");
    }
  }, [user, router]);

  useEffect(() => {
    if (!accessToken) return;
    adminListMembers(accessToken)
      .then((result) => setMembers(result.members))
      .catch((err) => setListError(err instanceof Error ? err.message : dictionary.members.genericError));
  }, [accessToken, dictionary.members.genericError]);

  function refreshMember(updated: MemberSummary): void {
    setMembers((prev) => prev?.map((member) => (member.id === updated.id ? updated : member)) ?? prev);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!accessToken) return;
    setCreateError(null);
    setCreateEmailError(null);
    setSaving(true);
    try {
      const created = await adminCreateMember(createForm, accessToken);
      setMembers((prev) => (prev ? [...prev, created] : [created]));
      setCreating(false);
      setCreateForm(EMPTY_FORM);
    } catch (err) {
      if (err instanceof ApiError && err.response.fieldErrors?.email) {
        setCreateEmailError(err.response.fieldErrors.email.join(" "));
      } else {
        setCreateError(err instanceof Error ? err.message : dictionary.members.genericError);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!accessToken || !editing) return;
    setEditError(null);
    setEditEmailError(null);
    setSaving(true);
    try {
      const updated = await adminUpdateMember(
        editing.id,
        {
          email: editForm.email,
          fullName: editForm.fullName,
          qualificationBg: editForm.qualificationBg,
          qualificationEn: editForm.qualificationEn,
          role: editForm.role,
        },
        accessToken,
      );
      refreshMember(updated);
      setEditing(null);
    } catch (err) {
      if (err instanceof ApiError && err.response.fieldErrors?.email) {
        setEditEmailError(err.response.fieldErrors.email.join(" "));
      } else {
        setEditError(err instanceof Error ? err.message : dictionary.members.genericError);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(member: MemberSummary): Promise<void> {
    if (!accessToken) return;
    setStatusError(null);
    try {
      const updated = await adminSetMemberStatus(member.id, { isActive: true }, accessToken);
      refreshMember(updated);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : dictionary.members.genericError);
    }
  }

  async function handleConfirmDeactivate(): Promise<void> {
    if (!accessToken || !confirmingDeactivate) return;
    setStatusError(null);
    try {
      const updated = await adminSetMemberStatus(
        confirmingDeactivate.id,
        { isActive: false },
        accessToken,
      );
      refreshMember(updated);
      setConfirmingDeactivate(null);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : dictionary.members.genericError);
    }
  }

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{dictionary.members.title}</h1>
        <Button onClick={() => setCreating(true)}>{dictionary.members.newMember}</Button>
      </div>

      {listError ? <p role="alert">{listError}</p> : null}
      {statusError ? <p role="alert">{statusError}</p> : null}

      {members ? (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>{dictionary.members.fullName}</th>
              <th style={{ textAlign: "left" }}>{dictionary.members.email}</th>
              <th style={{ textAlign: "left" }}>{dictionary.members.role}</th>
              <th style={{ textAlign: "left" }}>{dictionary.members.qualificationEn}</th>
              <th style={{ textAlign: "left" }}>{dictionary.members.status}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.fullName}</td>
                <td>{member.email}</td>
                <td>
                  {member.role === "ADMIN" ? dictionary.members.roleAdmin : dictionary.members.roleMember}
                </td>
                <td>
                  {pickBilingual(
                    { bg: member.qualificationBg, en: member.qualificationEn },
                    locale,
                  )}
                </td>
                <td>
                  <Badge variant={member.isActive ? "success" : "muted"}>
                    {member.isActive ? dictionary.members.active : dictionary.members.inactive}
                  </Badge>
                </td>
                <td style={{ display: "flex", gap: "0.5rem" }}>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      setEditing(member);
                      setEditForm({
                        email: member.email,
                        fullName: member.fullName,
                        qualificationBg: member.qualificationBg,
                        qualificationEn: member.qualificationEn,
                        role: member.role,
                        temporaryPassword: "",
                      });
                    }}
                  >
                    {dictionary.members.edit}
                  </Button>
                  {member.isActive ? (
                    <Button
                      variant="danger"
                      size="small"
                      disabled={member.id === user.id}
                      title={member.id === user.id ? dictionary.members.cannotDeactivateSelf : undefined}
                      onClick={() => setConfirmingDeactivate(member)}
                    >
                      {dictionary.members.deactivate}
                    </Button>
                  ) : (
                    <Button variant="secondary" size="small" onClick={() => void handleActivate(member)}>
                      {dictionary.members.activate}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>{dictionary.common.loading}</p>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title={dictionary.members.newMember}>
        <form onSubmit={handleCreate}>
          <FormField
            label={dictionary.members.fullName}
            value={createForm.fullName}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, fullName: event.target.value }))}
            required
          />
          <FormField
            label={dictionary.members.email}
            type="email"
            value={createForm.email}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
            error={createEmailError ?? undefined}
            required
          />
          <FormField
            label={dictionary.members.qualificationBg}
            value={createForm.qualificationBg}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, qualificationBg: event.target.value }))
            }
            required
          />
          <FormField
            label={dictionary.members.qualificationEn}
            value={createForm.qualificationEn}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, qualificationEn: event.target.value }))
            }
            required
          />
          <FormField
            label={dictionary.members.temporaryPassword}
            type="text"
            hint={dictionary.members.temporaryPasswordHint}
            value={createForm.temporaryPassword}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))
            }
            minLength={10}
            required
          />
          <div className="dho-field">
            <label htmlFor="createRole">{dictionary.members.role}</label>
            <select
              id="createRole"
              className="dho-input"
              value={createForm.role}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, role: event.target.value as UserRole }))
              }
            >
              <option value="MEMBER">{dictionary.members.roleMember}</option>
              <option value="ADMIN">{dictionary.members.roleAdmin}</option>
            </select>
          </div>
          {createError ? <p role="alert">{createError}</p> : null}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <Button type="submit" disabled={saving}>
              {saving ? dictionary.members.creating : dictionary.members.create}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
              {dictionary.members.cancel}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.fullName ?? ""}>
        <form onSubmit={handleEdit}>
          <FormField
            label={dictionary.members.fullName}
            value={editForm.fullName}
            onChange={(event) => setEditForm((prev) => ({ ...prev, fullName: event.target.value }))}
            required
          />
          <FormField
            label={dictionary.members.email}
            type="email"
            value={editForm.email}
            onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
            error={editEmailError ?? undefined}
            required
          />
          <FormField
            label={dictionary.members.qualificationBg}
            value={editForm.qualificationBg}
            onChange={(event) => setEditForm((prev) => ({ ...prev, qualificationBg: event.target.value }))}
            required
          />
          <FormField
            label={dictionary.members.qualificationEn}
            value={editForm.qualificationEn}
            onChange={(event) => setEditForm((prev) => ({ ...prev, qualificationEn: event.target.value }))}
            required
          />
          <div className="dho-field">
            <label htmlFor="editRole">{dictionary.members.role}</label>
            <select
              id="editRole"
              className="dho-input"
              value={editForm.role}
              onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value as UserRole }))}
            >
              <option value="MEMBER">{dictionary.members.roleMember}</option>
              <option value="ADMIN">{dictionary.members.roleAdmin}</option>
            </select>
          </div>
          {editError ? <p role="alert">{editError}</p> : null}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <Button type="submit" disabled={saving}>
              {saving ? dictionary.members.saving : dictionary.members.saveChanges}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              {dictionary.members.cancel}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={confirmingDeactivate !== null}
        onClose={() => setConfirmingDeactivate(null)}
        title={dictionary.members.confirmDeactivateTitle}
      >
        <p>{dictionary.members.confirmDeactivateBody}</p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <Button variant="danger" onClick={() => void handleConfirmDeactivate()}>
            {dictionary.common.confirm}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmingDeactivate(null)}>
            {dictionary.members.cancel}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
