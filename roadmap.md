# Roadmap — SaaS de agendamento para barbearias

## Base
- [ ] Ativar Lovable Cloud (banco + auth)
- [ ] Design system claro/neutro em src/styles.css (1 cor de destaque, tipografia moderna)
- [ ] Migração: barbershops, barbers, services, barber_services, customers, appointments, working_hours, blocked_times, notification_events, profiles, user_roles
- [ ] RLS multi-tenant + GRANTs + políticas públicas de leitura para a página de agendamento

## Auth
- [ ] Cadastro (dono cria a barbearia), login, recuperação de senha, logout
- [ ] Layout protegido /_authenticated

## Painel do dono
- [ ] Dashboard (hoje, próximos, clientes, barbeiros, faturamento estimado, ocupação, atalhos)
- [ ] Agenda dia/semana com detalhes em modal
- [ ] Agendamentos (criar, cancelar, remarcar, status)
- [ ] Clientes (histórico, último atendimento, total)
- [ ] Barbeiros (dados, serviços, horários/dias de trabalho, status)
- [ ] Serviços (nome, descrição, preço, duração, status)
- [ ] Configurações (barbearia, horário de funcionamento, bloqueios, slug público)

## Página pública
- [ ] /barbearia/$slug — fluxo serviço → barbeiro → data → horário → dados → confirmação
- [ ] Cálculo de disponibilidade real + prevenção de duplo agendamento

## Notificações
- [ ] Tabela + emissão de eventos (confirmação, lembrete 24h, lembrete no dia, cancelamento, remarcação) sem integração falsa

## SEO
- [ ] head() por rota
