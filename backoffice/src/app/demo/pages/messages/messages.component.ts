import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';
import { MessageService } from 'src/app/core/data/message.service';

@Component({
  selector: 'app-messages',
  imports: [...SHARED_IMPORTS, FormsModule],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.scss'
})
export class MessagesComponent implements OnInit {
  private messageService = inject(MessageService);

  conversations = signal<any[]>([]);
  selectedStagiaire = signal<any>(null);
  messages = signal<any[]>([]);
  newMessage = signal('');
  loading = signal(false);

  ngOnInit() {
    this.loadConversations();
  }

  loadConversations() {
    this.messageService.getAll().subscribe({
      next: (data) => this.conversations.set(data),
      error: () => {}
    });
  }

  selectConversation(stagiaireId: number, stagiaireName: string) {
    this.selectedStagiaire.set({ id: stagiaireId, name: stagiaireName });
    this.messageService.getByStagiaire(stagiaireId).subscribe({
      next: (data) => {
        this.messages.set(data);
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: () => {}
    });
  }

  sendMessage() {
    const content = this.newMessage().trim();
    if (!content || !this.selectedStagiaire()) return;

    this.loading.set(true);

    this.messageService.send({ stagiaireId: this.selectedStagiaire().id, content }).subscribe({
      next: (res: any) => {
        this.messages.update((msgs) => [...msgs, res.msg]);
        this.newMessage.set('');
        this.loading.set(false);
        this.loadConversations();
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  scrollToBottom() {
    const el = document.getElementById('messages-container');
    if (el) el.scrollTop = el.scrollHeight;
  }

  formatTime(timestamp: string): string {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(timestamp: string): string {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }
}
