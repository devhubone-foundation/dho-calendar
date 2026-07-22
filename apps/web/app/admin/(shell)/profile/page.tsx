"use client";

import { Avatar, Button, Card, FormField } from "@dho/ui";
import type { MemberSummary } from "@dho/contracts";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import {
  ApiError,
  getOwnProfile,
  resolveUploadUrl,
  updateOwnProfile,
  uploadOwnProfilePicture,
} from "../../../../lib/auth/api-client";
import { useAuth } from "../../../../lib/auth/auth-context";
import { useDictionary } from "../../../../lib/i18n/use-locale";

export default function ProfilePage() {
  const { accessToken, refreshProfile } = useAuth();
  const dictionary = useDictionary();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<MemberSummary | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [qualificationBg, setQualificationBg] = useState("");
  const [qualificationEn, setQualificationEn] = useState("");

  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [pictureError, setPictureError] = useState<string | null>(null);
  const [pictureMessage, setPictureMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    getOwnProfile(accessToken)
      .then((result) => {
        setProfile(result);
        setFullName(result.fullName);
        setEmail(result.email);
        setQualificationBg(result.qualificationBg);
        setQualificationEn(result.qualificationEn);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : dictionary.profile.genericError));
  }, [accessToken, dictionary.profile.genericError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!accessToken) return;
    setSaveError(null);
    setEmailError(null);
    setSaveMessage(null);
    setSaving(true);
    try {
      const updated = await updateOwnProfile(
        { fullName, email, qualificationBg, qualificationEn },
        accessToken,
      );
      setProfile(updated);
      setSaveMessage(dictionary.profile.saved);
      void refreshProfile();
    } catch (err) {
      if (err instanceof ApiError && err.response.fieldErrors?.email) {
        setEmailError(err.response.fieldErrors.email.join(" "));
      } else {
        setSaveError(err instanceof Error ? err.message : dictionary.profile.genericError);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePictureChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file || !accessToken) return;
    setPictureError(null);
    setPictureMessage(null);
    setUploading(true);
    try {
      const result = await uploadOwnProfilePicture(file, accessToken);
      setProfile((prev) => (prev ? { ...prev, profileImagePath: result.profileImagePath } : prev));
      setPictureMessage(dictionary.profile.pictureUpdated);
      void refreshProfile();
    } catch (err) {
      setPictureError(err instanceof Error ? err.message : dictionary.profile.pictureError);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  if (loadError) {
    return <p role="alert">{loadError}</p>;
  }
  if (!profile) {
    return <p>{dictionary.common.loading}</p>;
  }

  return (
    <Card style={{ maxWidth: "36rem" }} className="dho-stack">
      <h1>{dictionary.profile.title}</h1>

      <div className="dho-row">
        <Avatar
          name={profile.fullName}
          src={profile.profileImagePath ? resolveUploadUrl(profile.profileImagePath) : null}
          size={72}
        />
        <div className="dho-stack" style={{ gap: "0.25rem" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={dictionary.profile.uploadPicture}
            onChange={(event) => void handlePictureChange(event)}
            disabled={uploading}
          />
          {uploading ? <p>{dictionary.profile.uploading}</p> : null}
          {pictureMessage ? <p>{pictureMessage}</p> : null}
          {pictureError ? (
            <p role="alert" className="dho-field-error">
              {pictureError}
            </p>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="dho-stack">
        <FormField
          label={dictionary.profile.fullName}
          id="fullName"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
        <FormField
          label={dictionary.profile.email}
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          hint={dictionary.profile.emailHint}
          error={emailError ?? undefined}
          required
        />
        <div className="dho-field-pair">
          <FormField
            label={dictionary.profile.qualificationBg}
            id="qualificationBg"
            value={qualificationBg}
            onChange={(event) => setQualificationBg(event.target.value)}
            required
          />
          <FormField
            label={dictionary.profile.qualificationEn}
            id="qualificationEn"
            value={qualificationEn}
            onChange={(event) => setQualificationEn(event.target.value)}
            required
          />
        </div>
        {saveMessage ? <p>{saveMessage}</p> : null}
        {saveError ? (
          <p role="alert" className="dho-field-error">
            {saveError}
          </p>
        ) : null}
        <Button type="submit" variant="accent" disabled={saving}>
          {saving ? dictionary.profile.saving : dictionary.profile.save}
        </Button>
      </form>
    </Card>
  );
}
