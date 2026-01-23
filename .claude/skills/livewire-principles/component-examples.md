# Component Examples

> Side-by-side comparisons showing the principles in action.

---

## Trust the Framework: Form State

Livewire already knows when form fields change. You don't need to track it.

```php
// OVER-ENGINEERED: Tracking what Livewire already tracks
class EditUserModal extends Component
{
    public ?User $user = null;
    public string $name = '';
    public string $email = '';
    public bool $formModified = false;

    public function updatedName(): void
    {
        $this->formModified = true;
    }

    public function updatedEmail(): void
    {
        $this->formModified = true;
    }

    public function resetModal(): void
    {
        $this->user = null;
        $this->name = '';
        $this->email = '';
        $this->formModified = false;
    }

    public function save(): void
    {
        if (! $this->formModified) {
            return; // Why save if nothing changed?
        }
        // ...
    }
}
```

```php
// SIMPLE: Trust the framework
class EditUserModal extends Component
{
    public UserForm $form;

    public function openModal(User $user): void
    {
        $this->form->setUser($user);
    }

    public function save(): void
    {
        $this->form->save();
        Flux::modal('edit-user')->close();
    }
}
```

**Why simpler is better:**
- Validation handles "nothing changed" (no actual changes = no validation errors = nothing to save)
- The open method resets state - no need for separate reset logic
- Form object owns its data and validation
- 6 lines vs 30+ lines

---

## Trust the Framework: Validation

Laravel validation works. You don't need to check things twice.

```php
// OVER-ENGINEERED: Double-checking everything
public function assignRole(): void
{
    if (! $this->selectedUser) {
        $this->addError('user', 'Please select a user.');
        return;
    }

    if (! $this->selectedRole) {
        $this->addError('role', 'Please select a role.');
        return;
    }

    if (! Role::where('id', $this->selectedRole)->exists()) {
        $this->addError('role', 'Invalid role selected.');
        return;
    }

    $this->selectedUser->roles()->attach($this->selectedRole);
}
```

```php
// SIMPLE: Let validation do its job
public function assignRole(): void
{
    $this->validate([
        'selectedUser' => 'required|exists:users,id',
        'selectedRole' => 'required|exists:roles,id',
    ]);

    $this->selectedUser->roles()->attach($this->selectedRole);
}
```

**Why simpler is better:**
- Validation rules are declarative and readable
- `exists:` rules check the database for you
- Error messages are consistent with the rest of Laravel
- One place to understand all requirements

---

## Simple Over Clever: Form Objects

When a form has more than a few fields, extract to a Form object.

```php
// SCATTERED: Properties everywhere
class CreatePostComponent extends Component
{
    public string $title = '';
    public string $slug = '';
    public string $body = '';
    public string $excerpt = '';
    public ?int $categoryId = null;
    public array $tagIds = [];
    public bool $isPublished = false;
    public ?string $publishedAt = null;

    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:posts,slug',
            'body' => 'required|string',
            'excerpt' => 'nullable|string|max:500',
            'categoryId' => 'nullable|exists:categories,id',
            'tagIds.*' => 'exists:tags,id',
            'isPublished' => 'boolean',
            'publishedAt' => 'nullable|date',
        ];
    }

    public function save(): void
    {
        $validated = $this->validate();

        Post::create([
            'title' => $this->title,
            'slug' => $this->slug,
            'body' => $this->body,
            'excerpt' => $this->excerpt,
            'category_id' => $this->categoryId,
            'is_published' => $this->isPublished,
            'published_at' => $this->publishedAt,
        ]);

        // Don't forget the tags...
        // And reset all those properties...
    }
}
```

```php
// DELEGATED: Form owns its data
class CreatePostComponent extends Component
{
    public PostForm $form;

    public function save(): void
    {
        $post = $this->form->save();

        Flux::toast('Post created');
        $this->redirectRoute('posts.edit', $post);
    }
}

// app/Livewire/Forms/PostForm.php
class PostForm extends Form
{
    #[Validate('required|string|max:255')]
    public string $title = '';

    #[Validate('required|string|max:255|unique:posts,slug')]
    public string $slug = '';

    #[Validate('required|string')]
    public string $body = '';

    // ... other properties with validation attributes

    public function save(): Post
    {
        $this->validate();

        return Post::create($this->all());
    }
}
```

**Why simpler is better:**
- Component is tiny - just coordinates UI
- Form is self-contained - owns data, validation, persistence
- Easy to test the Form in isolation
- Clear separation: component manages UI, form manages data

---

## Let Errors Surface: No Silent Failures

Don't hide problems. If something unexpected happens, let it fail loudly.

```php
// HIDING PROBLEMS: Silent returns
public function deletePost(int $postId): void
{
    $post = Post::find($postId);

    if (! $post) {
        return; // Silently do nothing - user has no idea why
    }

    if ($post->user_id !== auth()->id()) {
        return; // Security through obscurity
    }

    $post->delete();
}
```

```php
// SURFACING PROBLEMS: Let them fail
public function deletePost(Post $post): void
{
    $this->authorize('delete', $post);

    $post->delete();

    Flux::toast('Post deleted');
}
```

**Why simpler is better:**
- Route model binding throws 404 if post doesn't exist (useful error)
- Policy throws 403 if unauthorized (useful error)
- Sentry captures unexpected failures
- User gets clear feedback, developers get clear errors

---

## Blade: Modal Patterns

You don't need close handlers. The open method resets state.

```blade
{{-- OVER-ENGINEERED: Explicit close handling --}}
<flux:modal
    name="edit-user"
    @close="resetEditUserModal"
>
    <form wire:submit="save">
        <flux:input label="Name" wire:model="userName" wire:change="markFormAsModified" />
        <flux:input label="Email" wire:model="userEmail" wire:change="markFormAsModified" />

        <div class="flex gap-2">
            <flux:button wire:click="resetEditUserModal">Cancel</flux:button>
            @if($formModified)
                <flux:button type="submit" variant="primary">Save</flux:button>
            @endif
        </div>
    </form>
</flux:modal>
```

```blade
{{-- SIMPLE: Let the framework handle it --}}
<flux:modal name="edit-user" variant="flyout">
    <form wire:submit="save" class="space-y-6">
        <flux:heading size="lg">Edit User</flux:heading>

        <flux:input label="Name" wire:model="form.name" />
        <flux:input label="Email" wire:model="form.email" />

        <div class="flex gap-2">
            <flux:spacer />
            <flux:modal.close>
                <flux:button>Cancel</flux:button>
            </flux:modal.close>
            <flux:button type="submit" variant="primary">Save</flux:button>
        </div>
    </form>
</flux:modal>
```

**Why simpler is better:**
- `flux:modal.close` handles the close - no wire:click needed
- No `@close` handler - next `openModal()` call resets everything
- No conditional button rendering - always show Save, let validation handle invalid states
- No `wire:change` tracking - Livewire already knows
