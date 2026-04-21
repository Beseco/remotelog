import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  if (!process.env.RESELLER_MODE) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    orgName,
    firstName,
    lastName,
    email,
    password,
    company,
    street,
    zip,
    city,
    country,
  } = body as Record<string, string>;

  if (!orgName?.trim() || !firstName?.trim() || !lastName?.trim() || !email?.trim() || !password) {
    return NextResponse.json(
      { error: "Alle Pflichtfelder sind erforderlich" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Das Passwort muss mindestens 8 Zeichen lang sein" },
      { status: 400 }
    );
  }

  const emailLower = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: emailLower } });
  if (existing) {
    return NextResponse.json(
      { error: "Diese E-Mail-Adresse wird bereits verwendet" },
      { status: 409 }
    );
  }

  // Load or create Free plan
  let freePlan = await prisma.plan.findFirst({
    where: { name: "Free", active: true },
  });
  if (!freePlan) {
    freePlan = await prisma.plan.create({
      data: {
        name: "Free",
        price: 0,
        maxCustomers: 2,
        maxProjects: 2,
        maxDevices: 5,
        maxUsers: 2,
        sortOrder: 0,
      },
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const verificationToken = randomBytes(32).toString("hex");
  const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const displayName = `${firstName.trim()} ${lastName.trim()}`;

  // Create org, user, subscription in one transaction
  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: orgName.trim() },
    });

    const user = await tx.user.create({
      data: {
        name: displayName,
        email: emailLower,
        passwordHash,
        role: "admin",
        active: true,
        organizationId: org.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        company: company?.trim() || null,
        street: street?.trim() || null,
        zip: zip?.trim() || null,
        city: city?.trim() || null,
        country: country?.trim() || null,
        verificationToken,
        verificationTokenExpiresAt,
      },
    });

    const subscription = await tx.subscription.create({
      data: {
        organizationId: org.id,
        planId: freePlan!.id,
        status: "trialing",
        trialEndsAt,
      },
    });

    return { org, user, subscription };
  });

  // Send verification email (non-blocking — don't fail registration if mail fails)
  try {
    console.log("[register] Sende Verifikations-E-Mail an:", emailLower);
    await sendVerificationEmail(emailLower, displayName, verificationToken, result.org.id);
    console.log("[register] E-Mail erfolgreich gesendet.");
  } catch (err) {
    console.error("[register] E-Mail-Versand fehlgeschlagen:", err);
  }

  return NextResponse.json({
    message: "Registrierung erfolgreich. Bitte bestätigen Sie Ihre E-Mail-Adresse.",
    organizationId: result.org.id,
    trialEndsAt: result.subscription.trialEndsAt,
  });
}
