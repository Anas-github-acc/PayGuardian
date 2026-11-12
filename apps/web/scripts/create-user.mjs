import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = "judge@payguardian.ai";
  const password = "JudgeAccess2026!";

  console.log(`Creating or confirming admin user: ${email}...`);
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (error.message.includes("already been registered")) {
      console.log("User already exists, updating password and confirming email...");
      const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;
      const existingUser = usersData.users.find((u) => u.email === email);
      if (existingUser) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          {
            password,
            email_confirm: true,
          },
        );
        if (updateError) throw updateError;
        console.log("User successfully updated and confirmed!");
      }
    } else {
      throw error;
    }
  } else {
    console.log("User successfully created and confirmed with ID:", data.user?.id);
  }
}

main().catch(console.error);
