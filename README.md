# Barber Hub

Crie um SaaS web responsivo de agendamento para barbearias, com aparência profissional, moderna, limpa e extremamente simples de usar em celulares.

O sistema deve ter dois tipos principais de usuários:

ADMINISTRADOR/DONO DA BARBEARIA

CLIENTE

Também deve existir o conceito de BARBEIRO/FUNCIONÁRIO associado a uma barbearia.

OBJETIVO PRINCIPAL

O dono de uma barbearia deve conseguir cadastrar sua empresa, seus barbeiros, seus serviços e seus horários de funcionamento.

O cliente deve conseguir acessar uma página pública da barbearia, escolher um serviço, escolher um barbeiro, visualizar os horários disponíveis e realizar um agendamento sem precisar passar por um processo complicado.

ESTRUTURA MULTI-TENANT

Este deve ser um SaaS multi-tenant.

Cada barbearia deve possuir seus próprios:

clientes

barbeiros

serviços

horários de funcionamento

agendamentos

configurações

Uma barbearia nunca pode visualizar ou alterar os dados de outra barbearia.

AUTENTICAÇÃO

Criar:

cadastro

login

recuperação de senha

logout

O dono deve conseguir criar sua própria barbearia durante o cadastro.

PAINEL DO DONO

Criar um dashboard com:

visão geral dos agendamentos do dia

próximos agendamentos

quantidade de clientes

quantidade de barbeiros

faturamento estimado do dia

atalhos para criar agendamento, cadastrar barbeiro e cadastrar serviço

Criar menu lateral com:

Dashboard
Agenda
Agendamentos
Clientes
Barbeiros
Serviços
Configurações

AGENDA

Criar uma agenda visual por dia e por semana.

Cada agendamento deve mostrar:

nome do cliente

serviço

barbeiro

horário

duração

status

Permitir:

criar agendamento manualmente

cancelar

remarcar

alterar status

visualizar detalhes

SERVIÇOS

O dono poderá cadastrar:

nome do serviço

descrição

preço

duração

status ativo/inativo

Exemplos:
Corte — R$40 — 40 minutos
Barba — R$30 — 30 minutos
Corte + Barba — R$60 — 60 minutos

BARBEIROS

O dono poderá cadastrar:

nome

foto opcional

telefone

serviços que realiza

horários de trabalho

dias de trabalho

status ativo/inativo

AGENDAMENTO DO CLIENTE

Criar uma página pública exclusiva para cada barbearia.

Exemplo:

/barbearia/nome-da-barbearia

Fluxo:

Cliente escolhe o serviço.

Cliente escolhe o barbeiro ou opção "qualquer barbeiro disponível".

Cliente escolhe a data.

Sistema mostra somente horários realmente disponíveis.

Cliente informa nome e telefone.

Cliente confirma o agendamento.

Sistema mostra uma tela de confirmação.

O sistema nunca deve permitir dois clientes reservarem o mesmo horário para o mesmo barbeiro.

DISPONIBILIDADE

A disponibilidade deve considerar:

horário de funcionamento da barbearia

horário de trabalho do barbeiro

duração do serviço

agendamentos existentes

bloqueios de horário

dias em que o barbeiro não trabalha

CLIENTES

Criar cadastro automático dos clientes quando realizarem o primeiro agendamento.

O dono poderá visualizar:

nome

telefone

histórico de agendamentos

último atendimento

quantidade de atendimentos

NOTIFICAÇÕES

Preparar a arquitetura para integração futura com WhatsApp.

Criar inicialmente o sistema de eventos necessários para:

confirmação de agendamento

lembrete 24 horas antes

lembrete no dia do atendimento

cancelamento

remarcação

Não invente uma integração de WhatsApp falsa. Deixe uma estrutura clara para conectar posteriormente uma API oficial do WhatsApp ou provedor compatível.

BANCO DE DADOS

Utilizar Supabase como backend e banco de dados.

Criar tabelas/estruturas apropriadas para:

users

barbershops

barbers

services

customers

appointments

working_hours

blocked_times

notification_events

Criar relacionamentos adequados entre essas entidades.

SEGURANÇA

Implementar Row Level Security no Supabase.

Um administrador só pode acessar os dados da própria barbearia.

Um cliente não deve conseguir acessar dados internos da barbearia ou dados de outros clientes.

DESIGN

O design deve ser moderno e profissional, mas sem excesso de elementos.

Priorizar:

celular

navegação simples

botões grandes

calendário fácil de entender

poucos passos para realizar um agendamento

Criar uma identidade visual adequada para um SaaS moderno de barbearias.

IMPORTANTE

Não adicionar funcionalidades desnecessárias nesta primeira versão.

Não criar marketplace.

Não criar aplicativo nativo para celular.

Não criar sistema de pagamento neste primeiro MVP.

Primeiro construir uma base sólida de agendamento, agenda e gerenciamento da barbearia.

Organize o código de forma modular e fácil de manter.

Antes de implementar qualquer funcionalidade complexa, priorize uma arquitetura que permita adicionar posteriormente:

WhatsApp

pagamentos

assinaturas do SaaS

relatórios avançados

programa de fidelidade

IA para atendimento pelo WhatsApp

múltiplas unidades

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/53c2234c-c4b7-429e-8d97-89a5cf7a87a7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
