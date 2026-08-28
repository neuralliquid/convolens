"use client";

import { useEffect, useRef } from "react";
import {
  ArrowRight,
  MessageSquare,
  BarChart2,
  Shield,
  Zap,
} from "lucide-react";
import Link from "next/link";
import "./moodboard.css";

export default function MoodboardPage() {
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Animate stats counters when they come into view
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const counters = entry.target.querySelectorAll(".counter-value");
            counters.forEach((counter) => {
              const target = parseInt(
                counter.getAttribute("data-target") || "0",
              );
              let count = 0;
              const updateCounter = () => {
                const increment = target / 30;
                if (count < target) {
                  count += increment;
                  counter.textContent = Math.ceil(count).toString();
                  setTimeout(updateCounter, 50);
                } else {
                  counter.textContent = target.toString();
                }
              };
              updateCounter();
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 },
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    // Add mouse move effect to cards
    const cards = document.querySelectorAll<HTMLElement>(".hover-card");
    const handleMouseMove = (event: MouseEvent) => {
      const card = event.currentTarget as HTMLElement;
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty("--x", `${x}%`);
      card.style.setProperty("--y", `${y}%`);
    };
    cards.forEach((card) =>
      card.addEventListener("mousemove", handleMouseMove),
    );

    return () => {
      observer.disconnect();
      cards.forEach((card) =>
        card.removeEventListener("mousemove", handleMouseMove),
      );
    };
  }, []);

  return (
    <div className="moodboard-container">
      {/* Background Vectors */}
      <div className="background-vectors">
        <div className="vector-shape vector-circle"></div>
        <div className="vector-shape vector-square"></div>
        <div className="vector-shape vector-triangle"></div>
        <div className="vector-shape vector-hexagon"></div>
        <div className="vector-shape vector-diamond"></div>
      </div>

      {/* Header */}
      <header className="moodboard-header">
        <h1>WhatsApp Conversation Summarizer</h1>
        <p>Design System Moodboard</p>
      </header>

      {/* Color Palette */}
      <section className="moodboard-section">
        <h2>Color Palette</h2>
        <div className="color-palette">
          <div
            className="color-swatch primary-green"
            title="Primary Green: #25D366"
          ></div>
          <div
            className="color-swatch secondary-green"
            title="Secondary Green: #128C7E"
          ></div>
          <div
            className="color-swatch light-green"
            title="Light Green: #DCF8C6"
          ></div>
          <div
            className="color-swatch dark-green"
            title="Dark Green: #075E54"
          ></div>
          <div
            className="color-swatch dark-bg"
            title="Dark Background: #1F2937"
          ></div>
          <div
            className="color-swatch light-bg"
            title="Light Background: #F9FAFB"
          ></div>
        </div>
      </section>

      {/* Typography */}
      <section className="moodboard-section">
        <h2>Typography</h2>
        <div className="typography-samples">
          <div className="typography-sample">
            <h1 className="heading-sample">Understand your conversations</h1>
            <h2 className="subheading-sample">
              Get insights from your WhatsApp chats
            </h2>
            <p className="body-sample">
              Analyze message patterns, response times, and conversation flow to
              understand communication dynamics with our powerful AI-driven
              tools.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <section className="moodboard-section" ref={statsRef}>
        <h2>Stats Cards</h2>
        <div className="stats-grid">
          <div className="stats-card hover-card">
            <div className="stats-icon">
              <MessageSquare />
            </div>
            <div className="stats-number">
              <span className="counter-value" data-target="4">
                0
              </span>
            </div>
            <div className="stats-label">Total Chats</div>
          </div>
          <div className="stats-card hover-card">
            <div className="stats-icon">
              <BarChart2 />
            </div>
            <div className="stats-number">
              <span className="counter-value" data-target="3">
                0
              </span>
            </div>
            <div className="stats-label">Active</div>
          </div>
          <div className="stats-card hover-card">
            <div className="stats-icon">
              <Shield />
            </div>
            <div className="stats-number">
              <span className="counter-value" data-target="1">
                0
              </span>
            </div>
            <div className="stats-label">Archived</div>
          </div>
          <div className="stats-card hover-card">
            <div className="stats-icon">
              <Zap />
            </div>
            <div className="stats-number">
              <span className="counter-value" data-target="75">
                0
              </span>
              %
            </div>
            <div className="stats-label">Completion</div>
          </div>
        </div>
      </section>

      {/* Chat Preview */}
      <section className="moodboard-section">
        <h2>Chat Preview</h2>
        <div className="chat-preview hover-card">
          <div className="chat-header">
            <div className="chat-avatar">J</div>
            <div className="chat-info">
              <div className="chat-name">John&apos;s Group</div>
              <div className="chat-participants">5 participants</div>
            </div>
          </div>
          <div className="chat-summary">
            <h3>AI Summary</h3>
            <p>
              This conversation primarily discusses project deadlines and
              upcoming meetings. Key points include:
            </p>
            <ul>
              <li>Team meeting scheduled for Friday at 3 PM</li>
              <li>Project Alpha deadline extended to next Tuesday</li>
              <li>New requirements document shared by Sarah</li>
            </ul>
            <div className="chat-metrics">
              <div className="chat-metric">
                <div className="metric-value">127</div>
                <div className="metric-label">Messages</div>
              </div>
              <div className="chat-metric">
                <div className="metric-value">4</div>
                <div className="metric-label">Days</div>
              </div>
              <div className="chat-metric">
                <div className="metric-value">5</div>
                <div className="metric-label">People</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="moodboard-section">
        <h2>Feature Cards</h2>
        <div className="features-grid">
          <div className="feature-card hover-card">
            <div className="feature-icon">
              <MessageSquare />
            </div>
            <h3>AI-Powered</h3>
            <p>
              Advanced machine learning algorithms analyze conversation patterns
              and extract key insights.
            </p>
          </div>
          <div className="feature-card hover-card">
            <div className="feature-icon">
              <BarChart2 />
            </div>
            <h3>Real-Time</h3>
            <p>
              Get instant analysis and updates as your conversations evolve over
              time.
            </p>
          </div>
          <div className="feature-card hover-card">
            <div className="feature-icon">
              <Shield />
            </div>
            <h3>Privacy-First</h3>
            <p>
              Your data never leaves your device. All processing happens locally
              for maximum security.
            </p>
          </div>
          <div className="feature-card hover-card">
            <div className="feature-icon">
              <Zap />
            </div>
            <h3>Analytics</h3>
            <p>
              Comprehensive metrics and visualizations to understand
              communication patterns.
            </p>
          </div>
        </div>
      </section>

      {/* Buttons */}
      <section className="moodboard-section">
        <h2>Buttons</h2>
        <div className="buttons-showcase">
          <button className="btn-primary">Get Started</button>
          <button className="btn-secondary">Learn More</button>
          <button className="btn-outline">View Demo</button>
          <button className="btn-icon">
            <ArrowRight />
          </button>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="moodboard-section">
        <h2>Tech Stack</h2>
        <div className="tech-stack">
          <div className="tech-badge">Next.js</div>
          <div className="tech-badge">React</div>
          <div className="tech-badge">TypeScript</div>
          <div className="tech-badge">Tailwind CSS</div>
          <div className="tech-badge">AI/ML</div>
        </div>
      </section>

      {/* CTA */}
      <section className="moodboard-section cta-section">
        <div className="cta-content">
          <h2>Ready to understand your conversations better?</h2>
          <p>Get started with WhatsApp Conversation Summarizer today.</p>
          <Link href="/" className="btn-primary">
            Try It Now
          </Link>
        </div>
      </section>
    </div>
  );
}
