# Test Examples

> The key question: "Would this test break if I refactored without changing behavior?"

---

## Behavior vs Implementation: The Core Distinction

**Behavior tests** verify outcomes - what changed in the world, what the user sees.
**Implementation tests** verify mechanics - how the component achieved the outcome.

Implementation tests break when you refactor. Behavior tests survive.

---

## Creating Records

```php
// IMPLEMENTATION: Testing component internals
it('sets isCreating flag when opening create modal', function () {
    Livewire::test(RoleManager::class)
        ->call('openCreateModal')
        ->assertSet('isCreating', true)
        ->assertSet('roleName', '')
        ->assertSet('roleDescription', '');
});

it('resets modal state after saving', function () {
    Livewire::test(RoleManager::class)
        ->set('roleName', 'Editor')
        ->call('save')
        ->assertSet('isCreating', false)
        ->assertSet('roleName', '');
});
```

```php
// BEHAVIOR: Testing what actually matters
it('creates a role', function () {
    Livewire::test(RoleManager::class)
        ->call('openCreateModal')
        ->set('roleName', 'Editor')
        ->set('roleDescription', 'Can edit posts')
        ->call('save')
        ->assertHasNoErrors();

    expect(Role::where('name', 'Editor')->exists())->toBeTrue();
});
```

**Why behavior is better:**
- If you refactor to use a Form object, the implementation test breaks
- The behavior test survives - it only cares that a Role was created
- One test replaces two, and it's more meaningful

---

## Validation

```php
// OVER-TESTING: Testing Laravel's validation works
it('requires a name', function () {
    Livewire::test(CreateUser::class)
        ->set('email', 'test@example.com')
        ->call('save')
        ->assertHasErrors(['name' => 'required']);
});

it('requires an email', function () {
    Livewire::test(CreateUser::class)
        ->set('name', 'John')
        ->call('save')
        ->assertHasErrors(['email' => 'required']);
});

it('requires a valid email format', function () {
    Livewire::test(CreateUser::class)
        ->set('name', 'John')
        ->set('email', 'not-an-email')
        ->call('save')
        ->assertHasErrors(['email' => 'email']);
});

it('requires email to be unique', function () {
    User::factory()->create(['email' => 'taken@example.com']);

    Livewire::test(CreateUser::class)
        ->set('name', 'John')
        ->set('email', 'taken@example.com')
        ->call('save')
        ->assertHasErrors(['email' => 'unique']);
});
```

```php
// SUFFICIENT: One test confirms validation exists
it('validates required fields', function () {
    Livewire::test(CreateUser::class)
        ->set('name', '')
        ->set('email', 'invalid')
        ->call('save')
        ->assertHasErrors(['name', 'email']);

    expect(User::count())->toBe(0);
});

it('creates a user with valid data', function () {
    Livewire::test(CreateUser::class)
        ->set('name', 'Jane Smith')
        ->set('email', 'jane@example.com')
        ->call('save')
        ->assertHasNoErrors();

    expect(User::where('email', 'jane@example.com')->exists())->toBeTrue();
});
```

**Why less is better:**
- Laravel's validation works - you don't need to prove it
- Test that validation *exists*, not every rule in detail
- Test the happy path thoroughly
- Two tests cover what four tests covered, with less coupling

---

## Form State Tracking (Don't Test This)

```php
// IMPLEMENTATION: Testing state you shouldn't have
it('marks form as modified when name changes', function () {
    Livewire::test(EditRole::class, ['role' => $role])
        ->assertSet('formModified', false)
        ->set('roleName', 'New Name')
        ->assertSet('formModified', true);
});

it('shows save button only when form is modified', function () {
    Livewire::test(EditRole::class, ['role' => $role])
        ->assertDontSee('Save')
        ->set('roleName', 'New Name')
        ->assertSee('Save');
});

it('resets form modified flag after save', function () {
    Livewire::test(EditRole::class, ['role' => $role])
        ->set('roleName', 'New Name')
        ->call('save')
        ->assertSet('formModified', false);
});
```

```php
// BEHAVIOR: Just test that editing works
it('updates a role', function () {
    $role = Role::factory()->create(['name' => 'Old Name']);

    Livewire::test(EditRole::class, ['role' => $role])
        ->set('roleName', 'New Name')
        ->call('save')
        ->assertHasNoErrors();

    expect($role->fresh()->name)->toBe('New Name');
});
```

**Why:**
- The `formModified` tracking shouldn't exist in the first place
- If it does exist, it's an implementation detail
- The test that matters: "Can I update a role?" Yes/No.

---

## Modal Lifecycle (Don't Test This)

```php
// IMPLEMENTATION: Testing modal mechanics
it('opens the modal with correct user data', function () {
    $user = User::factory()->create(['name' => 'Alice']);

    Livewire::test(UserList::class)
        ->call('openEditModal', $user->id)
        ->assertSet('showModal', true)
        ->assertSet('selectedUserId', $user->id)
        ->assertSet('userName', 'Alice');
});

it('closes the modal and resets state', function () {
    $user = User::factory()->create();

    Livewire::test(UserList::class)
        ->call('openEditModal', $user->id)
        ->call('closeModal')
        ->assertSet('showModal', false)
        ->assertSet('selectedUserId', null)
        ->assertSet('userName', '');
});
```

```php
// BEHAVIOR: Test the actual edit workflow
it('edits a user', function () {
    $user = User::factory()->create(['name' => 'Alice']);

    Livewire::test(UserList::class)
        ->call('openEditModal', $user->id)
        ->set('form.name', 'Alicia')
        ->call('save')
        ->assertHasNoErrors();

    expect($user->fresh()->name)->toBe('Alicia');
});
```

**Why:**
- Who cares if `showModal` is true? The user cares if they can edit.
- Modal reset is an implementation detail - test that the next edit works
- One test replaces two, tests what matters

---

## Edge Cases: Staff vs Students

```php
// FOR INTERNAL STAFF APPS: Happy path is enough
it('allows staff to view their projects', function () {
    $staff = User::factory()->staff()->create();
    $project = Project::factory()->for($staff)->create();

    $this->actingAs($staff)
        ->get(route('projects.show', $project))
        ->assertOk();
});

// We don't test: "What if staff try to access another staff member's project via URL manipulation?"
// Staff on a trusted LAN won't do this.
```

```php
// FOR STUDENT-FACING FEATURES: Be more thorough
it('allows students to view their own submissions', function () {
    $student = User::factory()->student()->create();
    $submission = Submission::factory()->for($student)->create();

    $this->actingAs($student)
        ->get(route('submissions.show', $submission))
        ->assertOk();
});

it('prevents students from viewing other students submissions', function () {
    $student = User::factory()->student()->create();
    $otherSubmission = Submission::factory()->create(); // belongs to someone else

    $this->actingAs($student)
        ->get(route('submissions.show', $otherSubmission))
        ->assertForbidden();
});

it('prevents students from modifying submission IDs in the form', function () {
    $student = User::factory()->student()->create();
    $submission = Submission::factory()->for($student)->create();
    $otherSubmission = Submission::factory()->create();

    $this->actingAs($student)
        ->put(route('submissions.update', $submission), [
            'submission_id' => $otherSubmission->id, // Trying to be sneaky
            'content' => 'Hacked!',
        ])
        ->assertForbidden(); // Policy should catch this
});
```

**Why the difference:**
- Trusted staff won't manipulate URLs to access others' data
- Students might - there's always one who'll try
- Authorization tests are essential for student-facing features
- But don't go overboard - test realistic attack vectors, not every theoretical possibility

---

## The Refactoring Test

Before committing a test, ask: **"If I refactored the component tomorrow (without changing behavior), would this test break?"**

- If **yes** → You're testing implementation. Reconsider.
- If **no** → You're testing behavior. Good.

```php
// FAILS the refactoring test:
->assertSet('isModalOpen', true)    // Breaks if you rename the property
->assertSet('formModified', false)  // Breaks if you remove state tracking
->call('resetModal')                // Breaks if you remove the method

// PASSES the refactoring test:
->assertSee('Edit User')            // Survives refactoring
->assertHasNoErrors()               // Survives refactoring
expect($user->fresh()->name)->toBe('New Name')  // Survives refactoring
```
